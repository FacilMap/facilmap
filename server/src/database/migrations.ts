import { clone, generateRandomId, promiseProps } from "../utils/utils";
import { streamEachPromise } from "../utils/streams";
import Sequelize, { CreationAttributes, DataTypes } from "sequelize";
import { isEqual } from "lodash";
import Database from "./database";
import { PadModel } from "./pad";
import { Line, Marker } from "facilmap-types";
import { LineModel, LinePointModel } from "./line";
import { getElevationForPoints } from "../elevation";

const Op = Sequelize.Op;

export default class DatabaseMigrations {

	_db: Database;

	constructor(database: Database) {
		this._db = database;
	}

	async _runMigrations(): Promise<void> {
		await this._renameColMigrations();
		await this._changeColMigrations();
		await this._addColMigrations();
		await this._dropdownKeyMigration();
		await this._elevationMigration();
		await this._legendMigration();
		await this._bboxMigration();
		await this._spatialMigration();
	}


	/** Run any migrations that rename columns */
	async _renameColMigrations(): Promise<void> {
		const queryInterface = this._db._conn.getQueryInterface();

		const lineAttrs = await queryInterface.describeTable('Lines');

		// Rename Line.points to Line.routePoints
		if(lineAttrs.points) {
			await queryInterface.renameColumn('Lines', 'points', 'routePoints');
		}

		// Change routing type "shortest" / "fastest" to "car", add type "track"
		if(lineAttrs.mode.type.indexOf("shortest") != -1)
			await this._db.lines.LineModel.update({ mode: "car" }, { where: { mode: { [Op.in]: [ "fastest", "shortest" ] } } });


		const padAttrs = await queryInterface.describeTable('Pads');

		// Rename writeId to adminId
		if(!padAttrs.adminId) {
			const Pad = this._db.pads.PadModel;
			await queryInterface.renameColumn('Pads', 'writeId', 'adminId');
			await queryInterface.addColumn('Pads', 'writeId', Pad.rawAttributes.writeId);

			const pads = await Pad.findAll<PadModel>();
			for(const pad of pads) {
				let writeId;
				do {
					writeId = generateRandomId(14);
				} while (await this._db.pads.padIdExists(writeId));

				await Pad.update({writeId}, { where: { id: pad.id } });
			}
		}
	}


	/** Run any migrations that change column types */
	async _changeColMigrations(): Promise<void> {
		const queryInterface = this._db._conn.getQueryInterface();

		for (const table of [ 'Pads', 'Markers', 'Lines', 'Types' ]) {
			const attributes: any = await queryInterface.describeTable(table);

			// allow null on Pad.name, Marker.name, Line.name
			if(["Pads", "Markers", "Lines"].includes(table) && !attributes.name.allowNull)
				await queryInterface.changeColumn(table, 'name', { type: Sequelize.TEXT, allowNull: true });

			// Change routing mode field from ENUM to TEXT
			if(table == "Lines" && attributes.mode.type != "TEXT")
				await queryInterface.changeColumn(table, "mode", { type: Sequelize.TEXT, allowNull: false, defaultValue: "" });
			if(table == "Types" && attributes.defaultMode.type != "TEXT")
				await queryInterface.changeColumn(table, "defaultMode", { type: Sequelize.TEXT, allowNull: true });
		}
	}


	/** Add all missing columns */
	async _addColMigrations(): Promise<void> {
		const queryInterface = this._db._conn.getQueryInterface();
		const exempt = [
			// These are added in another migration below
			['Marker', 'pos'], ['LinePoint', 'pos'], ['RoutePoint', 'pos']
		];

		for (const table of [ 'Pad', 'Marker', 'Type', 'View', 'Line', 'LinePoint' ]) {
			const model = this._db._conn.model(table);
			const attributes = await queryInterface.describeTable(model.getTableName());
			for(const attribute in model.rawAttributes) {
				if((model.rawAttributes[attribute].type as any).key !== DataTypes.VIRTUAL.key && !attributes[attribute] && !exempt.some((e) => e[0] == table && e[1] == attribute))
					await queryInterface.addColumn(model.getTableName(), attribute, model.rawAttributes[attribute]);
			}
		}
	}


	/** Get rid of the dropdown key, save the value in the data instead */
	async _dropdownKeyMigration(): Promise<void> {
		const dropdownKeysMigrated = await this._db.meta.getMeta("dropdownKeysMigrated");
		if(dropdownKeysMigrated == "1")
			return;

		const types = await this._db.types.TypeModel.findAll();
		for(const type of types) {
			const newFields = type.fields; // type.fields is a getter, we cannot modify the object directly
			const dropdowns = newFields.filter((field) => field.type == "dropdown");
			if(dropdowns.length > 0) {
				const objectStream = (type.type == "line" ? this._db.lines.getPadLinesByType(type.padId, type.id) : this._db.markers.getPadMarkersByType(type.padId, type.id)) as Highland.Stream<Marker | Line>;

				await streamEachPromise(objectStream, (object) => {
					const newData = clone(object.data);
					for(const dropdown of dropdowns) {
						const newVal = (dropdown.options || []).filter((option: any) => option.key == newData[dropdown.name])[0];
						if(newVal)
							newData[dropdown.name] = newVal.value;
						else if(newData[dropdown.name])
							console.log(`Warning: Dropdown key ${newData[dropdown.name]} for field ${dropdown.name} of type ${type.name} of pad ${type.padId} does not exist.`);
					}

					if(!isEqual(newData, object.data))
						return this._db.helpers._updatePadObject(type.type == "line" ? "Line" : "Marker", object.padId, object.id, {data: newData}, true);
				});

				dropdowns.forEach((dropdown) => {
					if(dropdown.default) {
						const newDefault = dropdown.options?.filter((option: any) => (option.key == dropdown.default))[0];
						if(newDefault)
							dropdown.default = newDefault.value;
						else
							console.log(`Warning: Default dropdown key ${dropdown.default} for field ${dropdown.name} of type ${type.name} of pad ${type.padId} does not exist.`);
					}

					dropdown.options?.forEach((option: any) => {
						delete option.key;
					});
				});

				await this._db.helpers._updatePadObject("Type", type.padId, type.id, {fields: newFields}, true);
			}
		}

		await this._db.meta.setMeta("dropdownKeysMigrated", "1");
	}


	/* Get elevation data for all lines/markers that don't have any yet */
	async _elevationMigration(): Promise<void> {
		const hasElevation = await this._db.meta.getMeta("hasElevation");
		if(hasElevation == "1")
			return;

		const lines = await this._db.lines.LineModel.findAll();
		for(const line of lines) {
			const trackPoints = await this._db.lines.LineModel.build({ id: line.id } satisfies Partial<CreationAttributes<LineModel>> as any).getLinePoints();
			await this._db.lines._setLinePoints(line.padId, line.id, trackPoints, true);
		}

		const markers = await this._db.markers.MarkerModel.findAll({where: {ele: null}});
		const elevations = await getElevationForPoints(markers);

		for (let i = 0; i < markers.length; i++) {
			await this._db.helpers._updatePadObject("Marker", markers[i].padId, markers[i].id, {ele: elevations[i]}, true);
		}

		await this._db.meta.setMeta("hasElevation", "1");
	}


	/* Add showInLegend field to types */
	async _legendMigration(): Promise<void> {
		const hasLegendOption = await this._db.meta.getMeta("hasLegendOption");
		if(hasLegendOption == "1")
			return;

		const types = await this._db.types.TypeModel.findAll();
		for(const type of types) {
			let showInLegend = false;

			if(type.colourFixed || (type.type == "marker" && type.symbolFixed && type.defaultSymbol) || (type.type == "marker" && type.shapeFixed) || (type.type == "line" && type.widthFixed))
				showInLegend = true;

			if(!showInLegend) {
				for(const field of type.fields) {
					if((field.type == "dropdown" || field.type == "checkbox") && (field.controlColour || (type.type == "marker" && field.controlSymbol) || (type.type == "marker" && field.controlShape) || (type.type == "line" && field.controlWidth))) {
						showInLegend = true;
						break;
					}
				}
			}

			await this._db.helpers._updatePadObject("Type", type.padId, type.id, { showInLegend }, true);
		}

		await this._db.meta.setMeta("hasLegendOption", "1");
	}


	/* Calculate bounding box for lines */
	async _bboxMigration(): Promise<void> {
		if(await this._db.meta.getMeta("hasBboxes") == "1")
			return;

		const LinePoint = this._db.lines.LinePointModel;

		for(const line of await this._db.lines.LineModel.findAll()) {
			const bbox = await promiseProps({
				top: LinePoint.min<number, LinePointModel>("lat", { where: { lineId: line.id } }),
				bottom: LinePoint.max<number, LinePointModel>("lat", { where: { lineId: line.id } }),
				left: LinePoint.min<number, LinePointModel>("lon", { where: { lineId: line.id } }),
				right: LinePoint.max<number, LinePointModel>("lon", { where: { lineId: line.id } })
			});

			if(isNaN(bbox.top) || isNaN(bbox.left) || isNaN(bbox.bottom) || isNaN(bbox.right)) // This is a broken line without track points
				await this._db.helpers._deletePadObject("Line", line.padId, line.id);
			else
				await this._db.helpers._updatePadObject("Line", line.padId, line.id, bbox, true);
		}

		await this._db.meta.setMeta("hasBboxes", "1");
	}


	/** Change lat/lon types into spatial points */
	async _spatialMigration(): Promise<void> {
		const queryInterface = this._db._conn.getQueryInterface();

		for (const modelName of ["Marker", "LinePoint", "RoutePoint"]) {
			// Add 'pos' column
			const model = this._db._conn.model(modelName);
			const table = model.getTableName() as string;
			const attrs = await queryInterface.describeTable(table);
			if(!attrs.pos) {
				await queryInterface.addColumn(table, 'pos', {
					...model.rawAttributes.pos,
					allowNull: true
				});
				await queryInterface.bulkUpdate(table, {
					pos: Sequelize.fn("POINT", Sequelize.col("lon"), Sequelize.col("lat"))
				}, {});
				await queryInterface.changeColumn(table, 'pos', model.rawAttributes.pos);
				await queryInterface.removeColumn(table, 'lat');
				await queryInterface.removeColumn(table, 'lon');
			}

			// We create the index here even in a non-migration case, because adding it to the model definition will cause an error if the column does not exist yet.
			const indexes: any = await queryInterface.showIndex(table);
			if (!indexes.some((index: any) => index.name == (Sequelize.Utils as any).underscore(`${table}_pos`)))
				await queryInterface.addIndex(table, { fields: ["pos"], type: "SPATIAL" });
		}
	}

}
