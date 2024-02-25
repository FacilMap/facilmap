import { generateRandomId, promiseProps } from "../utils/utils.js";
import { type CreationAttributes, DataTypes, Op, Utils, col, fn } from "sequelize";
import { cloneDeep, isEqual } from "lodash-es";
import Database from "./database.js";
import type { PadModel } from "./pad.js";
import type { LineModel, LinePointModel } from "./line.js";
import { getElevationForPoints } from "../elevation.js";

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
		await this._untitledMigration();
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

		//////////
		// Pads //
		//////////

		const padsAttributes = await queryInterface.describeTable("Pads");

		// Forbid null pad name
		if (padsAttributes.name.allowNull) {
			await this._db.pads.PadModel.update({ name: "" }, { where: { name: null as any } });
			await queryInterface.changeColumn("Pads", "name", this._db.pads.PadModel.getAttributes().name);
		}

		// Change description type from STRING to TEXT
		if (padsAttributes.description.type !== "TEXT") {
			await queryInterface.changeColumn("Pads", "description", this._db.pads.PadModel.getAttributes().description);
		}

		// Change legend1 type from STRING to TEXT
		if (padsAttributes.legend1.type !== "TEXT") {
			await queryInterface.changeColumn("Pads", "legend1", this._db.pads.PadModel.getAttributes().legend1);
		}

		// Change legend2 type from STRING to TEXT
		if (padsAttributes.legend2.type !== "TEXT") {
			await queryInterface.changeColumn("Pads", "legend2", this._db.pads.PadModel.getAttributes().legend2);
		}


		/////////////
		// Markers //
		/////////////

		const markersAttributes = await queryInterface.describeTable("Markers");

		// Forbid null marker name
		if (markersAttributes.name.allowNull) {
			await this._db.markers.MarkerModel.update({ name: "" }, { where: { name: null as any } });
			await queryInterface.changeColumn("Markers", "name", this._db.markers.MarkerModel.getAttributes().name);
		}

		// Remove marker colour default value
		if (markersAttributes.colour.defaultValue) {
			await queryInterface.changeColumn("Markers", "colour", this._db.markers.MarkerModel.getAttributes().colour);
		}

		// Remove marker size default value
		if (markersAttributes.size.defaultValue) {
			await queryInterface.changeColumn("Markers", "size", this._db.markers.MarkerModel.getAttributes().size);
		}

		// Forbid null marker symbol
		if (markersAttributes.symbol.allowNull) {
			await this._db.markers.MarkerModel.update({ symbol: "" }, { where: { symbol: null as any } });
			await queryInterface.changeColumn("Markers", "symbol", this._db.markers.MarkerModel.getAttributes().symbol);
		}

		// Forbid null marker shape
		if (markersAttributes.shape.allowNull) {
			await this._db.markers.MarkerModel.update({ shape: "" }, { where: { shape: null as any } });
			await queryInterface.changeColumn("Markers", "shape", this._db.markers.MarkerModel.getAttributes().shape);
		}


		///////////
		// Lines //
		///////////

		const linesAttributes = await queryInterface.describeTable("Lines");

		// Forbid null line name
		if (linesAttributes.name.allowNull) {
			await this._db.lines.LineModel.update({ name: "" }, { where: { name: null as any } });
			await queryInterface.changeColumn("Lines", "name", this._db.lines.LineModel.getAttributes().name);
		}

		// Change line mode field from ENUM to TEXT
		// Remove line mode default value
		if (linesAttributes.mode.type != "TEXT" || linesAttributes.mode.defaultValue) {
			await queryInterface.changeColumn("Lines", "mode", this._db.lines.LineModel.getAttributes().mode);
		}

		// Remove line width default value
		if (linesAttributes.width.defaultValue) {
			await queryInterface.changeColumn("Lines", "width", this._db.lines.LineModel.getAttributes().width);
		}

		// Remove line colour default value
		if (linesAttributes.colour.defaultValue) {
			await queryInterface.changeColumn("Lines", "colour", this._db.lines.LineModel.getAttributes().colour);
		}


		///////////
		// Types //
		///////////

		const typesAttributes = await queryInterface.describeTable("Types");

		// Forbid null defaultColour
		if (typesAttributes.defaultColour.allowNull) {
			await this._db.types.TypeModel.update({ defaultColour: "ff0000" }, {
				where: {
					defaultColour: null as any,
					type: "marker"
				}
			});
			await this._db.types.TypeModel.update({ defaultColour: "0000ff" }, {
				where: {
					defaultColour: null as any,
					type: "line"
				}
			});
			await queryInterface.changeColumn("Types", "defaultColour", this._db.types.TypeModel.getAttributes().defaultColour);
		}

		// Forbid null colourFixed
		if (typesAttributes.colourFixed.allowNull) {
			await this._db.types.TypeModel.update({ colourFixed: false }, { where: { colourFixed: null as any } });
			await queryInterface.changeColumn("Types", "colourFixed", this._db.types.TypeModel.getAttributes().colourFixed);
		}

		// Forbid null defaultSize
		if (typesAttributes.defaultSize.allowNull) {
			// 25 is the old default size, now it is 30
			await this._db.types.TypeModel.update({ defaultSize: 25 }, { where: { defaultSize: null as any } });
			await queryInterface.changeColumn("Types", "defaultSize", this._db.types.TypeModel.getAttributes().defaultSize);
		}

		// Forbid null sizeFixed
		if (typesAttributes.sizeFixed.allowNull) {
			await this._db.types.TypeModel.update({ sizeFixed: false }, { where: { sizeFixed: null as any } });
			await queryInterface.changeColumn("Types", "sizeFixed", this._db.types.TypeModel.getAttributes().sizeFixed);
		}

		// Forbid null defaultSymbol
		if (typesAttributes.defaultSymbol.allowNull) {
			await this._db.types.TypeModel.update({ defaultSymbol: "" }, { where: { defaultSymbol: null as any } });
			await queryInterface.changeColumn("Types", "defaultSymbol", this._db.types.TypeModel.getAttributes().defaultSymbol);
		}

		// Forbid null symbolFixed
		if (typesAttributes.symbolFixed.allowNull) {
			await this._db.types.TypeModel.update({ symbolFixed: false }, { where: { symbolFixed: null as any } });
			await queryInterface.changeColumn("Types", "symbolFixed", this._db.types.TypeModel.getAttributes().symbolFixed);
		}

		// Forbid null defaultShape
		if (typesAttributes.defaultShape.allowNull) {
			await this._db.types.TypeModel.update({ defaultShape: "" }, { where: { defaultShape: null as any } });
			await queryInterface.changeColumn("Types", "defaultShape", this._db.types.TypeModel.getAttributes().defaultShape);
		}

		// Forbid null shapeFixed
		if (typesAttributes.shapeFixed.allowNull) {
			await this._db.types.TypeModel.update({ shapeFixed: false }, { where: { shapeFixed: null as any } });
			await queryInterface.changeColumn("Types", "shapeFixed", this._db.types.TypeModel.getAttributes().shapeFixed);
		}

		// Forbid null defaultWidth
		if (typesAttributes.defaultWidth.allowNull) {
			await this._db.types.TypeModel.update({ defaultWidth: 4 }, { where: { defaultWidth: null as any } });
			await queryInterface.changeColumn("Types", "defaultWidth", this._db.types.TypeModel.getAttributes().defaultWidth);
		}

		// Forbid null widthFixed
		if (typesAttributes.widthFixed.allowNull) {
			await this._db.types.TypeModel.update({ widthFixed: false }, { where: { widthFixed: null as any } });
			await queryInterface.changeColumn("Types", "widthFixed", this._db.types.TypeModel.getAttributes().widthFixed);
		}

		// Change defaultMode from ENUM to TEXT
		// Forbid null defaultMode
		if (typesAttributes.defaultMode.type != "TEXT" || typesAttributes.defaultMode.allowNull) {
			if (typesAttributes.defaultMode.allowNull) {
				await this._db.types.TypeModel.update({ defaultMode: "" }, { where: { defaultMode: null as any } });
			}
			await queryInterface.changeColumn("Types", "defaultMode", this._db.types.TypeModel.getAttributes().defaultMode);
		}

		// Forbid null modeFixed
		if (typesAttributes.modeFixed.allowNull) {
			await this._db.types.TypeModel.update({ modeFixed: false }, { where: { modeFixed: null as any } });
			await queryInterface.changeColumn("Types", "modeFixed", this._db.types.TypeModel.getAttributes().modeFixed);
		}

		// Forbid null showInLegend
		if (typesAttributes.showInLegend.allowNull) {
			await this._db.types.TypeModel.update({ showInLegend: false }, { where: { showInLegend: null as any } });
			await queryInterface.changeColumn("Types", "showInLegend", this._db.types.TypeModel.getAttributes().showInLegend);
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
			const rawAttributes = model.getAttributes();
			for(const attribute in rawAttributes) {
				if((rawAttributes[attribute].type as any).key !== DataTypes.VIRTUAL.key && !attributes[attribute] && !exempt.some((e) => e[0] == table && e[1] == attribute))
					await queryInterface.addColumn(model.getTableName(), attribute, rawAttributes[attribute]);
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
				const objectStream = (type.type == "line" ? this._db.lines.getPadLinesByType(type.padId, type.id) : this._db.markers.getPadMarkersByType(type.padId, type.id));

				for await (const object of objectStream) {
					const newData = cloneDeep(object.data);
					for(const dropdown of dropdowns) {
						const newVal = (dropdown.options || []).filter((option: any) => option.key == newData[dropdown.name])[0];
						if(newVal)
							newData[dropdown.name] = newVal.value;
						else if(newData[dropdown.name])
							console.log(`Warning: Dropdown key ${newData[dropdown.name]} for field ${dropdown.name} of type ${type.name} of pad ${type.padId} does not exist.`);
					}

					if(!isEqual(newData, object.data))
						return this._db.helpers._updatePadObject(type.type == "line" ? "Line" : "Marker", object.padId, object.id, {data: newData}, true);
				}

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
					pos: fn("POINT", col("lon"), col("lat"))
				}, {});
				await queryInterface.changeColumn(table, 'pos', model.rawAttributes.pos);
				await queryInterface.removeColumn(table, 'lat');
				await queryInterface.removeColumn(table, 'lon');
			}

			// We create the index here even in a non-migration case, because adding it to the model definition will cause an error if the column does not exist yet.
			const indexes: any = await queryInterface.showIndex(table);
			if (!indexes.some((index: any) => index.name == (Utils as any).underscore(`${table}_pos`)))
				await queryInterface.addIndex(table, { fields: ["pos"], type: "SPATIAL" });
		}
	}

	/** Clear "Untitled marker", "Untitled line" and "New FacilMap" names. These are now rendered in the frontend instead. */
	async _untitledMigration(): Promise<void> {
		if(await this._db.meta.getMeta("untitledMigrationCompleted") == "1")
			return;

		await this._db.markers.MarkerModel.update({ name: "" }, { where: { name: "Untitled marker" } });
		await this._db.lines.LineModel.update({ name: "" }, { where: { name: "Untitled line" } });
		await this._db.pads.PadModel.update({ name: "" }, { where: { name: "New FacilMap" } });

		await this._db.meta.setMeta("untitledMigrationCompleted", "1");
	}

}
