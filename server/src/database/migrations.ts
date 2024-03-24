import { generateRandomId, promiseProps } from "../utils/utils.js";
import { DataTypes, Op, Utils, col, fn } from "sequelize";
import { cloneDeep, isEqual } from "lodash-es";
import Database from "./database.js";
import type { PadModel } from "./pad.js";
import type { LinePointModel } from "./line.js";
import { getElevationForPoint } from "facilmap-utils";
import type { MarkerModel } from "./marker.js";
import { ReadableStream } from "stream/web";
import type { PadId } from "facilmap-types";

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
		await this._fieldsNullMigration();
		await this._extraInfoNullMigration();
		await this._typesIdxMigration();

		console.log("DB migration: All migrations finished");
	}


	/** Run any migrations that rename columns */
	async _renameColMigrations(): Promise<void> {
		const queryInterface = this._db._conn.getQueryInterface();

		const lineAttrs = await queryInterface.describeTable('Lines');

		// Rename Line.points to Line.routePoints
		if(lineAttrs.points) {
			console.log("DB migration: Rename Lines.points to Lines.routePoints");
			await queryInterface.renameColumn('Lines', 'points', 'routePoints');
		}

		// Change routing type "shortest" / "fastest" to "car", add type "track"
		if(lineAttrs.mode.type.indexOf("shortest") != -1) {
			console.log("DB migration: Change \"shortest\"/\"fastest\" route mode to \"car\"");
			await this._db.lines.LineModel.update({ mode: "car" }, { where: { mode: { [Op.in]: [ "fastest", "shortest" ] } } });
		}


		const padAttrs = await queryInterface.describeTable('Pads');

		// Rename writeId to adminId
		if(!padAttrs.adminId) {
			console.log("DB migration: Rename pad writeId to adminId");
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
			console.log("DB migration: Change null pad names to \"\"");
			await this._db.pads.PadModel.update({ name: "" }, { where: { name: null as any } });
			await queryInterface.changeColumn("Pads", "name", this._db.pads.PadModel.getAttributes().name);
		}

		// Change description type from STRING to TEXT
		if (padsAttributes.description.type !== "TEXT") {
			console.log("DB migration: Change Pads.description from STRING to TEXT");
			await queryInterface.changeColumn("Pads", "description", this._db.pads.PadModel.getAttributes().description);
		}

		// Change legend1 type from STRING to TEXT
		if (padsAttributes.legend1.type !== "TEXT") {
			console.log("DB migration: Change Pads.legend1 from STRING to TEXT");
			await queryInterface.changeColumn("Pads", "legend1", this._db.pads.PadModel.getAttributes().legend1);
		}

		// Change legend2 type from STRING to TEXT
		if (padsAttributes.legend2.type !== "TEXT") {
			console.log("DB migration: Change Pads.legend2 from STRING to TEXT");
			await queryInterface.changeColumn("Pads", "legend2", this._db.pads.PadModel.getAttributes().legend2);
		}


		/////////////
		// Markers //
		/////////////

		const markersAttributes = await queryInterface.describeTable("Markers");

		// Forbid null marker name
		if (markersAttributes.name.allowNull) {
			console.log("DB migration: Change null marker names to \"\"");
			await this._db.markers.MarkerModel.update({ name: "" }, { where: { name: null as any } });
			await queryInterface.changeColumn("Markers", "name", this._db.markers.MarkerModel.getAttributes().name);
		}

		// Remove marker colour default value
		if (markersAttributes.colour.defaultValue) {
			console.log("DB migration: Remove defaultValue from Markers.colour");
			await queryInterface.changeColumn("Markers", "colour", this._db.markers.MarkerModel.getAttributes().colour);
		}

		// Remove marker size default value
		if (markersAttributes.size.defaultValue) {
			console.log("DB migration: Remove defaultValue from Markers.size");
			await queryInterface.changeColumn("Markers", "size", this._db.markers.MarkerModel.getAttributes().size);
		}

		// Forbid null marker symbol
		if (markersAttributes.symbol.allowNull) {
			console.log("DB migration: Remove defaultValue from Markers.symbol");
			await this._db.markers.MarkerModel.update({ symbol: "" }, { where: { symbol: null as any } });
			await queryInterface.changeColumn("Markers", "symbol", this._db.markers.MarkerModel.getAttributes().symbol);
		}

		// Forbid null marker shape
		if (markersAttributes.shape.allowNull) {
			console.log("DB migration: Remove defaultValue from Markers.shape");
			await this._db.markers.MarkerModel.update({ shape: "" }, { where: { shape: null as any } });
			await queryInterface.changeColumn("Markers", "shape", this._db.markers.MarkerModel.getAttributes().shape);
		}


		///////////
		// Lines //
		///////////

		const linesAttributes = await queryInterface.describeTable("Lines");

		// Forbid null line name
		if (linesAttributes.name.allowNull) {
			console.log("DB migration: Change null line names to \"\"");
			await this._db.lines.LineModel.update({ name: "" }, { where: { name: null as any } });
			await queryInterface.changeColumn("Lines", "name", this._db.lines.LineModel.getAttributes().name);
		}

		// Change line mode field from ENUM to TEXT
		// Remove line mode default value
		if (linesAttributes.mode.type != "TEXT" || linesAttributes.mode.defaultValue) {
			console.log("DB migration: Change Lines.mode from ENUM to TEXT");
			await queryInterface.changeColumn("Lines", "mode", this._db.lines.LineModel.getAttributes().mode);
		}

		// Remove line width default value
		if (linesAttributes.width.defaultValue) {
			console.log("DB migration: Remove defaultValue from Lines.width");
			await queryInterface.changeColumn("Lines", "width", this._db.lines.LineModel.getAttributes().width);
		}

		// Remove line colour default value
		if (linesAttributes.colour.defaultValue) {
			console.log("DB migration: Remove defaultValue from Lines.colour");
			await queryInterface.changeColumn("Lines", "colour", this._db.lines.LineModel.getAttributes().colour);
		}


		///////////
		// Types //
		///////////

		const typesAttributes = await queryInterface.describeTable("Types");

		// Forbid null defaultColour
		if (typesAttributes.defaultColour.allowNull) {
			console.log("DB migration: Set default colour for types");
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
			console.log("DB migration: Disallow null for Types.colourFixed");
			await this._db.types.TypeModel.update({ colourFixed: false }, { where: { colourFixed: null as any } });
			await queryInterface.changeColumn("Types", "colourFixed", this._db.types.TypeModel.getAttributes().colourFixed);
		}

		// Forbid null defaultSize
		if (typesAttributes.defaultSize.allowNull) {
			console.log("DB migration: Disallow null for Types.defaultSize");
			// 25 is the old default size, now it is 30
			await this._db.types.TypeModel.update({ defaultSize: 25 }, { where: { defaultSize: null as any } });
			await queryInterface.changeColumn("Types", "defaultSize", this._db.types.TypeModel.getAttributes().defaultSize);
		}

		// Forbid null sizeFixed
		if (typesAttributes.sizeFixed.allowNull) {
			console.log("DB migration: Disallow null for Types.sizeFixed");
			await this._db.types.TypeModel.update({ sizeFixed: false }, { where: { sizeFixed: null as any } });
			await queryInterface.changeColumn("Types", "sizeFixed", this._db.types.TypeModel.getAttributes().sizeFixed);
		}

		// Forbid null defaultSymbol
		if (typesAttributes.defaultSymbol.allowNull) {
			console.log("DB migration: Disallow null for Types.defaultSymbol");
			await this._db.types.TypeModel.update({ defaultSymbol: "" }, { where: { defaultSymbol: null as any } });
			await queryInterface.changeColumn("Types", "defaultSymbol", this._db.types.TypeModel.getAttributes().defaultSymbol);
		}

		// Forbid null symbolFixed
		if (typesAttributes.symbolFixed.allowNull) {
			console.log("DB migration: Disallow null for Types.symbolFixed");
			await this._db.types.TypeModel.update({ symbolFixed: false }, { where: { symbolFixed: null as any } });
			await queryInterface.changeColumn("Types", "symbolFixed", this._db.types.TypeModel.getAttributes().symbolFixed);
		}

		// Forbid null defaultShape
		if (typesAttributes.defaultShape.allowNull) {
			console.log("DB migration: Disallow null for Types.defaultShape");
			await this._db.types.TypeModel.update({ defaultShape: "" }, { where: { defaultShape: null as any } });
			await queryInterface.changeColumn("Types", "defaultShape", this._db.types.TypeModel.getAttributes().defaultShape);
		}

		// Forbid null shapeFixed
		if (typesAttributes.shapeFixed.allowNull) {
			console.log("DB migration: Disallow null for Types.shapeFixed");
			await this._db.types.TypeModel.update({ shapeFixed: false }, { where: { shapeFixed: null as any } });
			await queryInterface.changeColumn("Types", "shapeFixed", this._db.types.TypeModel.getAttributes().shapeFixed);
		}

		// Forbid null defaultWidth
		if (typesAttributes.defaultWidth.allowNull) {
			console.log("DB migration: Disallow null for Types.defaultWidth");
			await this._db.types.TypeModel.update({ defaultWidth: 4 }, { where: { defaultWidth: null as any } });
			await queryInterface.changeColumn("Types", "defaultWidth", this._db.types.TypeModel.getAttributes().defaultWidth);
		}

		// Forbid null widthFixed
		if (typesAttributes.widthFixed.allowNull) {
			console.log("DB migration: Disallow null for Types.widthFixed");
			await this._db.types.TypeModel.update({ widthFixed: false }, { where: { widthFixed: null as any } });
			await queryInterface.changeColumn("Types", "widthFixed", this._db.types.TypeModel.getAttributes().widthFixed);
		}

		// Change defaultMode from ENUM to TEXT
		// Forbid null defaultMode
		if (typesAttributes.defaultMode.type != "TEXT" || typesAttributes.defaultMode.allowNull) {
			if (typesAttributes.defaultMode.allowNull) {
				console.log("DB migration: Disallow null for Types.defaultMode");
				await this._db.types.TypeModel.update({ defaultMode: "" }, { where: { defaultMode: null as any } });
			}
			console.log("DB migration: Change Types.defaultMode from ENUM to TEXT");
			await queryInterface.changeColumn("Types", "defaultMode", this._db.types.TypeModel.getAttributes().defaultMode);
		}

		// Forbid null modeFixed
		if (typesAttributes.modeFixed.allowNull) {
			console.log("DB migration: Disallow null for Types.modeFixed");
			await this._db.types.TypeModel.update({ modeFixed: false }, { where: { modeFixed: null as any } });
			await queryInterface.changeColumn("Types", "modeFixed", this._db.types.TypeModel.getAttributes().modeFixed);
		}

		// Forbid null showInLegend
		if (typesAttributes.showInLegend.allowNull) {
			console.log("DB migration: Disallow null for Types.showInLegend");
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
				if((rawAttributes[attribute].type as any).key !== DataTypes.VIRTUAL.key && !attributes[attribute] && !exempt.some((e) => e[0] == table && e[1] == attribute)) {
					console.log(`DB migration: Add column ${model.getTableName() as string}.${attribute}`);
					await queryInterface.addColumn(model.getTableName(), attribute, rawAttributes[attribute]);
				}
			}
		}
	}


	/** Get rid of the dropdown key, save the value in the data instead */
	async _dropdownKeyMigration(): Promise<void> {
		const dropdownKeysMigrated = await this._db.meta.getMeta("dropdownKeysMigrated");
		if(dropdownKeysMigrated == "1")
			return;

		console.log("DB migration: Change dropdown keys to dropdown values");

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
							console.log(`DB migration: Warning: Dropdown key ${newData[dropdown.name]} for field ${dropdown.name} of type ${type.name} of pad ${type.padId} does not exist.`);
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
							console.log(`DB migration: Warning: Default dropdown key ${dropdown.default} for field ${dropdown.name} of type ${type.name} of pad ${type.padId} does not exist.`);
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
		if(hasElevation == "2")
			return;

		console.log("DB migration: Get marker elevations in background");

		(async () => {
			const markers = await this._db.markers.MarkerModel.findAll({ where: { ele: null } });

			let anyError = false;
			const stream = new ReadableStream<{ marker: MarkerModel; ele: number | undefined }>({
				async start(controller) {
					await Promise.allSettled(markers.map(async (marker) => {
						try {
							const ele = await getElevationForPoint(marker);
							controller.enqueue({ marker, ele });
						} catch (err: any) {
							console.warn(`DB migration: Error fetching elevaton for ${marker.lat},${marker.lon}.`, err);
							anyError = true;
						}
					}));

					controller.close();
				}
			});

			let i = 0;
			for await (const { marker, ele } of stream) {
				await this._db.helpers._updatePadObject("Marker", marker.padId, marker.id, { ele }, true);

				if (++i % 1000 === 0) {
					console.log(`DB migration: Elevation migration ${i}/${markers.length}`);
				}
			}

			if (anyError) {
				console.warn("DB migration: There were errors, not marking elevation migration as completed.");
			} else {
				console.log("DB migration: Elevation migration completed");
				await this._db.meta.setMeta("hasElevation", "2");
			}
		})().catch((err) => {
			console.error("DB migration: Elevation migration crashed", err);
		});
	}


	/* Add showInLegend field to types */
	async _legendMigration(): Promise<void> {
		const hasLegendOption = await this._db.meta.getMeta("hasLegendOption");
		if(hasLegendOption == "1")
			return;

		console.log("DB migration: Add Types.showInLegend");

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

		console.log("DB migration: Add line bboxes");

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
				console.log(`DB migration: Add ${table}.pos`);
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
			if (!indexes.some((index: any) => index.name == (Utils as any).underscore(`${table}_pos`))) {
				console.log(`DB migration: Add index for ${table}.pos`);
				await queryInterface.addIndex(table, { fields: ["pos"], type: "SPATIAL" });
			}
		}
	}

	/** Clear "Untitled marker", "Untitled line" and "New FacilMap" names. These are now rendered in the frontend instead. */
	async _untitledMigration(): Promise<void> {
		if(await this._db.meta.getMeta("untitledMigrationCompleted") == "1")
			return;

		console.log("DB migration: Empty name for unnamed markers/lines/pads");

		await this._db.markers.MarkerModel.update({ name: "" }, { where: { name: "Untitled marker" } });
		await this._db.lines.LineModel.update({ name: "" }, { where: { name: "Untitled line" } });
		await this._db.pads.PadModel.update({ name: "" }, { where: { name: "New FacilMap" } });

		await this._db.meta.setMeta("untitledMigrationCompleted", "1");
	}

	/** Remove various null values from type fields. */
	async _fieldsNullMigration(): Promise<void> {
		if(await this._db.meta.getMeta("fieldsNullMigrationCompleted") == "1")
			return;

		console.log("DB migration: Normalize null values for field properties");

		const allTypes = await this._db.types.TypeModel.findAll({
			attributes: ["id", "fields"]
		});

		for (const type of allTypes) {
			let fields = type.fields;
			let fieldsChanged = false;
			for (const field of fields) {
				if (field.default === null) {
					delete field.default;
					fieldsChanged = true;
				}

				for (const option of field.options ?? []) {
					if (option.size === null) {
						option.size = undefined;
						fieldsChanged = true;
					}

					if (option.size != null && option.size < 15) {
						option.size = 15;
						fieldsChanged = true;
					}
				}
			}
			if (fieldsChanged) {
				await type.update({
					fields
				});
			}
		}

		await this._db.meta.setMeta("fieldsNullMigrationCompleted", "1");
	}


	/** Convert "null" to null for extraInfo */
	async _extraInfoNullMigration(): Promise<void> {
		if(await this._db.meta.getMeta("extraInfoNullMigrationCompleted") == "1")
			return;

		console.log("DB migration: Change Lines.extraInfo from \"null\"/\"{}\" to null");

		await this._db.lines.LineModel.update({
			extraInfo: null
		}, {
			where: {
				extraInfo: {
					[Op.in]: ["null", "{}"]
				}
			}
		});

		await this._db.meta.setMeta("extraInfoNullMigrationCompleted", "1");
	}

	/** Add Types.idx */
	async _typesIdxMigration(): Promise<void> {
		if(await this._db.meta.getMeta("typesIdxMigrationCompleted") == "1")
			return;

		console.log("DB migration: Set initial values for Types.idx");

		const allTypes = await this._db.types.TypeModel.findAll({
			attributes: ["id", "padId"]
		});

		let lastIndex: Record<PadId, number> = Object.create(null);

		for (const type of allTypes) {
			if (!Object.prototype.hasOwnProperty.call(lastIndex, type.padId)) {
				lastIndex[type.padId] = -1;
			}

			await type.update({ idx: ++lastIndex[type.padId] });
		}

		await this._db.meta.setMeta("typesIdxMigrationCompleted", "1");
	}

}
