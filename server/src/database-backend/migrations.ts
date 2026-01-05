import { generateRandomId, promiseProps } from "../utils/utils.js";
import { DataTypes, Op, Utils, col, fn } from "sequelize";
import { cloneDeep, isEqual, omit } from "lodash-es";
import DatabaseBackend from "./database-backend.js";
import type { MapModel } from "./map.js";
import type { LinePointModel } from "./line.js";
import { forEachAsync, getElevationForPoint } from "facilmap-utils";
import type { MarkerModel } from "./marker.js";
import { ADMIN_LINK_COMMENT, READ_LINK_COMMENT, WRITE_LINK_COMMENT, type ID, type MapPermissions, type Type } from "facilmap-types";
import { streamToIterable } from "../utils/streams.js";
import { createJwtSecret, createMapToken, createSalt, getSlugHash } from "../utils/crypt.js";
import type { RawLine, RawMarker } from "../utils/permissions.js";

export default class DatabaseBackendMigrations {

	backend: DatabaseBackend;

	constructor(backend: DatabaseBackend) {
		this.backend = backend;
	}

	async _runMigrationsBeforeSync(): Promise<void> {
		await this._renamePadsTableMigration();
	}

	async _runMigrationsAfterSync1(): Promise<void> {
		await this._renameColMigrations();
		await this._changeColMigrations();
		await this._addColMigrations();
		await this._legendMigration();
		await this._bboxMigration();
		await this._spatialMigration();
		await this._untitledMigration();
		await this._fieldsNullMigration();
		await this._extraInfoNullMigration();
		await this._typesIdxMigration();
		await this._viewsIdxMigration();
		await this._fieldIconsMigration();
		await this._historyPadMigration();
		await this._mapIdMigration();
		await this._fieldIdMigration();
		await this._dropdownKeyMigration(); // This is very old, but now it only works after migrating to field IDs
	}

	async _runMigrationsAfterSync2(): Promise<void> {
		await this._addColMigrations();
		await this._mapLinkMigration(); // This needs MapLink.mapId to exist, which can only be created after mapIdMigration

		(async () => {
			await this._elevationMigration();
		})().catch((err) => {
			console.error("DB migration: Unexpected error in background migration", err);
		}).finally(() => {
			console.log("DB migration: All migrations finished");
		});
	}

	/** Rename Pads table to Maps */
	async _renamePadsTableMigration(): Promise<void> {
		const queryInterface = this.backend._conn.getQueryInterface();

		if (await queryInterface.tableExists("Pads") && !await queryInterface.tableExists("Maps")) {
			console.log("DB migration: Rename Pads table to Maps");

			await queryInterface.renameTable("Pads", "Maps");
		}
	}

	/** Run any migrations that rename columns */
	async _renameColMigrations(): Promise<void> {
		const queryInterface = this.backend._conn.getQueryInterface();


		const markerAttrs = await queryInterface.describeTable('Markers');

		// Rename Marker.symbol to Marker.icon
		if (markerAttrs.symbol) {
			console.log("DB migration: Rename Markers.symbol to Markers.icons");
			await queryInterface.renameColumn('Markers', 'symbol', 'icon');
		}

		// Rename Marker.padId to Marker.mapId
		if (markerAttrs.padId) {
			console.log("DB migration: Rename Markers.padId to Markers.mapId");
			await queryInterface.renameColumn("Markers", "padId", "mapId");
		}


		const lineAttrs = await queryInterface.describeTable('Lines');

		// Rename Line.points to Line.routePoints
		if(lineAttrs.points) {
			console.log("DB migration: Rename Lines.points to Lines.routePoints");
			await queryInterface.renameColumn('Lines', 'points', 'routePoints');
		}

		// Change routing type "shortest" / "fastest" to "car", add type "track"
		if(lineAttrs.mode.type.indexOf("shortest") != -1) {
			console.log("DB migration: Change \"shortest\"/\"fastest\" route mode to \"car\"");
			await this.backend.lines.LineModel.update({ mode: "car" }, { where: { mode: { [Op.in]: [ "fastest", "shortest" ] } } });
		}

		// Rename Line.padId to Line.mapId
		if (lineAttrs.padId) {
			console.log("DB migration: Rename Lines.padId to Lines.mapId");
			await queryInterface.renameColumn("Lines", "padId", "mapId");
		}


		const typeAttrs = await queryInterface.describeTable('Types');

		// Rename Types.defaultSymbol to Types.defaultIcon
		if (typeAttrs.defaultSymbol) {
			console.log("DB migration: Rename Types.defaultSymbol to Types.defaultIcon");
			await queryInterface.renameColumn('Types', 'defaultSymbol', 'defaultIcon');
		}

		// Rename Types.symbolFixed to Types.iconFixed
		if (typeAttrs.symbolFixed) {
			console.log("DB migration: Rename Types.symbolFixed to Types.iconFixed");
			await queryInterface.renameColumn('Types', 'symbolFixed', 'iconFixed');
		}

		// Rename Type.padId to type.mapId
		if (typeAttrs.padId) {
			console.log("DB migration: Rename Types.padId to Types.mapId");
			await queryInterface.renameColumn("Types", "padId", "mapId");
		}


		const viewAttrs = await queryInterface.describeTable("Views");

		// Rename View.padId to View.mapId
		if (viewAttrs.padId) {
			console.log("DB migration: Rename Views.padId to Views.mapId");
			await queryInterface.renameColumn("Views", "padId", "mapId");
		}


		const mapAttrs = await queryInterface.describeTable('Maps');

		// Rename writeId to adminId
		if(mapAttrs.writeId && !mapAttrs.adminId) {
			console.log("DB migration: Rename map writeId to adminId");
			const MapModel = this.backend.maps.MapModel;
			await queryInterface.renameColumn('Maps', 'writeId', 'adminId');
			await queryInterface.addColumn('Maps', 'writeId', { type: DataTypes.STRING, allowNull: false });

			const maps = await MapModel.findAll<MapModel>();
			for(const map of maps) {
				let writeId;
				do {
					writeId = generateRandomId(14);
				} while (await this.backend.maps.mapSlugExists(writeId));

				await MapModel.update({ writeId } as any, { where: { id: map.id } });
			}
		}


		const historyAttrs = await queryInterface.describeTable("History");

		// Rename HistoryEntry.padId to HistoryEntry.mapId
		if (historyAttrs.padId) {
			console.log("DB migration: Rename History.padId to History.mapId");
			await queryInterface.renameColumn("History", "padId", "mapId");
		}
	}


	/** Run any migrations that change column types */
	async _changeColMigrations(): Promise<void> {
		const queryInterface = this.backend._conn.getQueryInterface();

		//////////
		// Maps //
		//////////

		const mapsAttributes = await queryInterface.describeTable("Maps");

		// Forbid null map name
		if (mapsAttributes.name.allowNull) {
			console.log("DB migration: Change null map names to \"\"");
			await this.backend.maps.MapModel.update({ name: "" }, { where: { name: null as any } });
			await queryInterface.changeColumn("Maps", "name", this.backend.maps.MapModel.getAttributes().name);
		}

		// Change description type from STRING to TEXT
		if (mapsAttributes.description.type !== "TEXT") {
			console.log("DB migration: Change Maps.description from STRING to TEXT");
			await queryInterface.changeColumn("Maps", "description", this.backend.maps.MapModel.getAttributes().description);
		}

		// Change legend1 type from STRING to TEXT
		if (mapsAttributes.legend1.type !== "TEXT") {
			console.log("DB migration: Change Maps.legend1 from STRING to TEXT");
			await queryInterface.changeColumn("Maps", "legend1", this.backend.maps.MapModel.getAttributes().legend1);
		}

		// Change legend2 type from STRING to TEXT
		if (mapsAttributes.legend2.type !== "TEXT") {
			console.log("DB migration: Change Maps.legend2 from STRING to TEXT");
			await queryInterface.changeColumn("Maps", "legend2", this.backend.maps.MapModel.getAttributes().legend2);
		}


		/////////////
		// Markers //
		/////////////

		const markersAttributes = await queryInterface.describeTable("Markers");

		// Forbid null marker name
		if (markersAttributes.name.allowNull) {
			console.log("DB migration: Change null marker names to \"\"");
			await this.backend.markers.MarkerModel.update({ name: "" }, { where: { name: null as any } });
			await queryInterface.changeColumn("Markers", "name", this.backend.markers.MarkerModel.getAttributes().name);
		}

		// Remove marker colour default value
		if (markersAttributes.colour.defaultValue) {
			console.log("DB migration: Remove defaultValue from Markers.colour");
			await queryInterface.changeColumn("Markers", "colour", this.backend.markers.MarkerModel.getAttributes().colour);
		}

		// Remove marker size default value
		if (markersAttributes.size.defaultValue) {
			console.log("DB migration: Remove defaultValue from Markers.size");
			await queryInterface.changeColumn("Markers", "size", this.backend.markers.MarkerModel.getAttributes().size);
		}

		// Forbid null marker icon
		if (markersAttributes.icon.allowNull) {
			console.log("DB migration: Remove defaultValue from Markers.icon");
			await this.backend.markers.MarkerModel.update({ icon: "" }, { where: { icon: null as any } });
			await queryInterface.changeColumn("Markers", "icon", this.backend.markers.MarkerModel.getAttributes().icon);
		}

		// Forbid null marker shape
		if (markersAttributes.shape.allowNull) {
			console.log("DB migration: Remove defaultValue from Markers.shape");
			await this.backend.markers.MarkerModel.update({ shape: "" }, { where: { shape: null as any } });
			await queryInterface.changeColumn("Markers", "shape", this.backend.markers.MarkerModel.getAttributes().shape);
		}


		///////////
		// Lines //
		///////////

		const linesAttributes = await queryInterface.describeTable("Lines");

		// Forbid null line name
		if (linesAttributes.name.allowNull) {
			console.log("DB migration: Change null line names to \"\"");
			await this.backend.lines.LineModel.update({ name: "" }, { where: { name: null as any } });
			await queryInterface.changeColumn("Lines", "name", this.backend.lines.LineModel.getAttributes().name);
		}

		// Change line mode field from ENUM to TEXT
		// Remove line mode default value
		if (linesAttributes.mode.type != "TEXT" || linesAttributes.mode.defaultValue) {
			console.log("DB migration: Change Lines.mode from ENUM to TEXT");
			await queryInterface.changeColumn("Lines", "mode", this.backend.lines.LineModel.getAttributes().mode);
		}

		// Remove line width default value
		if (linesAttributes.width.defaultValue) {
			console.log("DB migration: Remove defaultValue from Lines.width");
			await queryInterface.changeColumn("Lines", "width", this.backend.lines.LineModel.getAttributes().width);
		}

		// Remove line colour default value
		if (linesAttributes.colour.defaultValue) {
			console.log("DB migration: Remove defaultValue from Lines.colour");
			await queryInterface.changeColumn("Lines", "colour", this.backend.lines.LineModel.getAttributes().colour);
		}


		///////////
		// Types //
		///////////

		const typesAttributes = await queryInterface.describeTable("Types");

		// Forbid null defaultColour
		if (typesAttributes.defaultColour.allowNull) {
			console.log("DB migration: Set default colour for types");
			await this.backend.types.TypeModel.update({ defaultColour: "ff0000" }, {
				where: {
					defaultColour: null as any,
					type: "marker"
				}
			});
			await this.backend.types.TypeModel.update({ defaultColour: "0000ff" }, {
				where: {
					defaultColour: null as any,
					type: "line"
				}
			});
			await queryInterface.changeColumn("Types", "defaultColour", this.backend.types.TypeModel.getAttributes().defaultColour);
		}

		// Forbid null colourFixed
		if (typesAttributes.colourFixed.allowNull) {
			console.log("DB migration: Disallow null for Types.colourFixed");
			await this.backend.types.TypeModel.update({ colourFixed: false }, { where: { colourFixed: null as any } });
			await queryInterface.changeColumn("Types", "colourFixed", this.backend.types.TypeModel.getAttributes().colourFixed);
		}

		// Forbid null defaultSize
		if (typesAttributes.defaultSize.allowNull) {
			console.log("DB migration: Disallow null for Types.defaultSize");
			// 25 is the old default size, now it is 30
			await this.backend.types.TypeModel.update({ defaultSize: 25 }, { where: { defaultSize: null as any } });
			await queryInterface.changeColumn("Types", "defaultSize", this.backend.types.TypeModel.getAttributes().defaultSize);
		}

		// Forbid null sizeFixed
		if (typesAttributes.sizeFixed.allowNull) {
			console.log("DB migration: Disallow null for Types.sizeFixed");
			await this.backend.types.TypeModel.update({ sizeFixed: false }, { where: { sizeFixed: null as any } });
			await queryInterface.changeColumn("Types", "sizeFixed", this.backend.types.TypeModel.getAttributes().sizeFixed);
		}

		// Forbid null defaultIcon
		if (typesAttributes.defaultIcon.allowNull) {
			console.log("DB migration: Disallow null for Types.defaultIcon");
			await this.backend.types.TypeModel.update({ defaultIcon: "" }, { where: { defaultIcon: null as any } });
			await queryInterface.changeColumn("Types", "defaultIcon", this.backend.types.TypeModel.getAttributes().defaultIcon);
		}

		// Forbid null iconFixed
		if (typesAttributes.iconFixed.allowNull) {
			console.log("DB migration: Disallow null for Types.iconFixed");
			await this.backend.types.TypeModel.update({ iconFixed: false }, { where: { iconFixed: null as any } });
			await queryInterface.changeColumn("Types", "iconFixed", this.backend.types.TypeModel.getAttributes().iconFixed);
		}

		// Forbid null defaultShape
		if (typesAttributes.defaultShape.allowNull) {
			console.log("DB migration: Disallow null for Types.defaultShape");
			await this.backend.types.TypeModel.update({ defaultShape: "" }, { where: { defaultShape: null as any } });
			await queryInterface.changeColumn("Types", "defaultShape", this.backend.types.TypeModel.getAttributes().defaultShape);
		}

		// Forbid null shapeFixed
		if (typesAttributes.shapeFixed.allowNull) {
			console.log("DB migration: Disallow null for Types.shapeFixed");
			await this.backend.types.TypeModel.update({ shapeFixed: false }, { where: { shapeFixed: null as any } });
			await queryInterface.changeColumn("Types", "shapeFixed", this.backend.types.TypeModel.getAttributes().shapeFixed);
		}

		// Forbid null defaultWidth
		if (typesAttributes.defaultWidth.allowNull) {
			console.log("DB migration: Disallow null for Types.defaultWidth");
			await this.backend.types.TypeModel.update({ defaultWidth: 4 }, { where: { defaultWidth: null as any } });
			await queryInterface.changeColumn("Types", "defaultWidth", this.backend.types.TypeModel.getAttributes().defaultWidth);
		}

		// Forbid null widthFixed
		if (typesAttributes.widthFixed.allowNull) {
			console.log("DB migration: Disallow null for Types.widthFixed");
			await this.backend.types.TypeModel.update({ widthFixed: false }, { where: { widthFixed: null as any } });
			await queryInterface.changeColumn("Types", "widthFixed", this.backend.types.TypeModel.getAttributes().widthFixed);
		}

		// Change defaultMode from ENUM to TEXT
		// Forbid null defaultMode
		if (typesAttributes.defaultMode.type != "TEXT" || typesAttributes.defaultMode.allowNull) {
			if (typesAttributes.defaultMode.allowNull) {
				console.log("DB migration: Disallow null for Types.defaultMode");
				await this.backend.types.TypeModel.update({ defaultMode: "" }, { where: { defaultMode: null as any } });
			}
			console.log("DB migration: Change Types.defaultMode from ENUM to TEXT");
			await queryInterface.changeColumn("Types", "defaultMode", this.backend.types.TypeModel.getAttributes().defaultMode);
		}

		// Forbid null modeFixed
		if (typesAttributes.modeFixed.allowNull) {
			console.log("DB migration: Disallow null for Types.modeFixed");
			await this.backend.types.TypeModel.update({ modeFixed: false }, { where: { modeFixed: null as any } });
			await queryInterface.changeColumn("Types", "modeFixed", this.backend.types.TypeModel.getAttributes().modeFixed);
		}

		// Forbid null showInLegend
		if (typesAttributes.showInLegend.allowNull) {
			console.log("DB migration: Disallow null for Types.showInLegend");
			await this.backend.types.TypeModel.update({ showInLegend: false }, { where: { showInLegend: null as any } });
			await queryInterface.changeColumn("Types", "showInLegend", this.backend.types.TypeModel.getAttributes().showInLegend);
		}
	}


	/** Add all missing columns */
	async _addColMigrations(): Promise<void> {
		const queryInterface = this.backend._conn.getQueryInterface();
		const exempt = [
			// These are added in another migration below
			['Marker', 'pos'], ['LinePoint', 'pos'], ['RoutePoint', 'pos']
		];

		for (const table of [ 'Map', 'MapLink', 'Marker', 'MarkerData', 'Type', 'View', 'Line', 'LineData', 'LinePoint', 'History' ]) {
			const model = this.backend._conn.model(table);
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
		const dropdownKeysMigrated = await this.backend.meta.getMeta("dropdownKeysMigrated");
		if(dropdownKeysMigrated == "1")
			return;

		console.log("DB migration: Change dropdown keys to dropdown values");

		const types = await this.backend.types.TypeModel.findAll();
		for(const type of types) {
			const newFields = type.fields; // type.fields is a getter, we cannot modify the object directly
			const dropdowns = newFields.filter((field) => field.type == "dropdown");
			if(dropdowns.length > 0) {
				const objectStream = (type.type == "line" ? this.backend.lines.getMapLinesByType(type.mapId, type.id) : this.backend.markers.getMapMarkersByType(type.mapId, type.id));

				for await (const object of objectStream) {
					const newData = cloneDeep(object.data);
					for(const dropdown of dropdowns) {
						const newVal = (dropdown.options || []).filter((option: any) => option.key == newData[dropdown.id])[0];
						if(newVal)
							newData[dropdown.id] = newVal.value;
						else if(newData[dropdown.id])
							console.log(`DB migration: Warning: Dropdown key ${newData[dropdown.id]} for field ${dropdown.name} of type ${type.name} of map ${type.mapId} does not exist.`);
					}

					if (!isEqual(newData, object.data)) {
						if (type.type === "line") {
							await this.backend.lines.updateLine(object.mapId, object.id, { data: newData });
						} else {
							await this.backend.markers.updateMarker(object.mapId, object.id, { data: newData });
						}
					}
				}

				dropdowns.forEach((dropdown) => {
					if(dropdown.default) {
						const newDefault = dropdown.options?.filter((option: any) => (option.key == dropdown.default))[0];
						if(newDefault)
							dropdown.default = newDefault.value;
						else
							console.log(`DB migration: Warning: Default dropdown key ${dropdown.default} for field ${dropdown.name} of type ${type.name} of map ${type.mapId} does not exist.`);
					}

					dropdown.options?.forEach((option: any) => {
						delete option.key;
					});
				});

				await this.backend.types.updateType(type.mapId, type.id, { fields: newFields });
			}
		}

		await this.backend.meta.setMeta("dropdownKeysMigrated", "1");
	}


	/* Get elevation data for all lines/markers that don't have any yet */
	async _elevationMigration(): Promise<void> {
		try {
			const hasElevation = await this.backend.meta.getMeta("hasElevation");
			if(hasElevation == "2")
				return;

			console.log("DB migration: Get marker elevations in background");

			const markers = await this.backend.markers.MarkerModel.findAll({ where: { ele: null } });

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
			for await (const { marker, ele } of streamToIterable(stream)) {
				await this.backend.markers.updateMarker(marker.mapId, marker.id, { ele });

				if (++i % 1000 === 0) {
					console.log(`DB migration: Elevation migration ${i}/${markers.length}`);
				}
			}

			if (anyError) {
				console.warn("DB migration: There were errors, not marking elevation migration as completed.");
			} else {
				console.log("DB migration: Elevation migration completed");
				await this.backend.meta.setMeta("hasElevation", "2");
			}
		} catch (err: any) {
			console.error("DB migration: Elevation migration crashed", err);
		}
	}


	/* Add showInLegend field to types */
	async _legendMigration(): Promise<void> {
		const hasLegendOption = await this.backend.meta.getMeta("hasLegendOption");
		if(hasLegendOption == "1")
			return;

		console.log("DB migration: Add Types.showInLegend");

		const types = await this.backend.types.TypeModel.findAll();
		for(const type of types) {
			let showInLegend = false;

			if(type.colourFixed || (type.type == "marker" && type.iconFixed && type.defaultIcon) || (type.type == "marker" && type.shapeFixed) || (type.type == "line" && type.widthFixed))
				showInLegend = true;

			if(!showInLegend) {
				for(const field of type.fields) {
					if((field.type == "dropdown" || field.type == "checkbox") && (field.controlColour || (type.type == "marker" && field.controlIcon) || (type.type == "marker" && field.controlShape) || (type.type == "line" && field.controlWidth))) {
						showInLegend = true;
						break;
					}
				}
			}

			await this.backend.types.updateType(type.mapId, type.id, { showInLegend });
		}

		await this.backend.meta.setMeta("hasLegendOption", "1");
	}


	/* Calculate bounding box for lines */
	async _bboxMigration(): Promise<void> {
		if(await this.backend.meta.getMeta("hasBboxes") == "1")
			return;

		console.log("DB migration: Add line bboxes");

		const LinePoint = this.backend.lines.LinePointModel;

		for(const line of await this.backend.lines.LineModel.findAll()) {
			const bbox = await promiseProps({
				top: LinePoint.min<number, LinePointModel>("lat", { where: { lineId: line.id } }),
				bottom: LinePoint.max<number, LinePointModel>("lat", { where: { lineId: line.id } }),
				left: LinePoint.min<number, LinePointModel>("lon", { where: { lineId: line.id } }),
				right: LinePoint.max<number, LinePointModel>("lon", { where: { lineId: line.id } })
			});

			if(isNaN(bbox.top) || isNaN(bbox.left) || isNaN(bbox.bottom) || isNaN(bbox.right)) // This is a broken line without track points
				await this.backend.lines.deleteLine(line.mapId, line.id);
			else
				await this.backend.lines.updateLine(line.mapId, line.id, bbox);
		}

		await this.backend.meta.setMeta("hasBboxes", "1");
	}


	/** Change lat/lon types into spatial points */
	async _spatialMigration(): Promise<void> {
		const queryInterface = this.backend._conn.getQueryInterface();

		for (const modelName of ["Marker", "LinePoint", "RoutePoint"]) {
			// Add 'pos' column
			const model = this.backend._conn.model(modelName);
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
		if(await this.backend.meta.getMeta("untitledMigrationCompleted") == "1")
			return;

		console.log("DB migration: Empty name for unnamed markers/lines/maps");

		await this.backend.markers.MarkerModel.update({ name: "" }, { where: { name: "Untitled marker" } });
		await this.backend.lines.LineModel.update({ name: "" }, { where: { name: "Untitled line" } });
		await this.backend.maps.MapModel.update({ name: "" }, { where: { name: "New FacilMap" } });

		await this.backend.meta.setMeta("untitledMigrationCompleted", "1");
	}

	/** Remove various null values from type fields. */
	async _fieldsNullMigration(): Promise<void> {
		if(await this.backend.meta.getMeta("fieldsNullMigrationCompleted") == "1")
			return;

		console.log("DB migration: Normalize null values for field properties");

		const allTypes = await this.backend.types.TypeModel.findAll({
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

		await this.backend.meta.setMeta("fieldsNullMigrationCompleted", "1");
	}


	/** Convert "null" to null for extraInfo */
	async _extraInfoNullMigration(): Promise<void> {
		if(await this.backend.meta.getMeta("extraInfoNullMigrationCompleted") == "1")
			return;

		console.log("DB migration: Change Lines.extraInfo from \"null\"/\"{}\" to null");

		await this.backend.lines.LineModel.update({
			extraInfo: null
		}, {
			where: {
				extraInfo: {
					[Op.in]: ["null", "{}"]
				}
			}
		});

		await this.backend.meta.setMeta("extraInfoNullMigrationCompleted", "1");
	}

	/** Add Types.idx */
	async _typesIdxMigration(): Promise<void> {
		if(await this.backend.meta.getMeta("typesIdxMigrationCompleted") == "1")
			return;

		console.log("DB migration: Set initial values for Types.idx");

		const allTypes = await this.backend.types.TypeModel.findAll({
			attributes: ["id", "mapId"]
		});

		let lastIndex: Record<ID, number> = Object.create(null);

		for (const type of allTypes) {
			if (!Object.prototype.hasOwnProperty.call(lastIndex, type.mapId)) {
				lastIndex[type.mapId] = -1;
			}

			await type.update({ idx: ++lastIndex[type.mapId] });
		}

		await this.backend.meta.setMeta("typesIdxMigrationCompleted", "1");
	}

	/** Add Views.idx */
	async _viewsIdxMigration(): Promise<void> {
		if(await this.backend.meta.getMeta("viewsIdxMigrationCompleted") == "1")
			return;

		console.log("DB migration: Set initial values for Views.idx");

		const allViews = await this.backend.views.ViewModel.findAll({
			attributes: ["id", "mapId"]
		});

		let lastIndex: Record<ID, number> = Object.create(null);

		for (const view of allViews) {
			if (!Object.prototype.hasOwnProperty.call(lastIndex, view.mapId)) {
				lastIndex[view.mapId] = -1;
			}

			await view.update({ idx: ++lastIndex[view.mapId] });
		}

		await this.backend.meta.setMeta("viewsIdxMigrationCompleted", "1");
	}

	/** Rename Field.controlSymbol to Field.controlIcon and FieldOption.symbol to FieldOption.icon */
	async _fieldIconsMigration(): Promise<void> {
		if(await this.backend.meta.getMeta("fieldIconsMigrationCompleted") == "1")
			return;

		console.log("DB migration: Rename Field.controlSymbol to Field.controlIcon and FieldOption.symbol to FieldOption.icon");

		const allTypes = await this.backend.types.TypeModel.findAll({
			attributes: ["id", "fields"]
		});

		for (const type of allTypes) {
			let fields = type.fields;
			let fieldsChanged = false;
			for (const field of fields) {
				if ("controlSymbol" in field) {
					field.controlIcon = field.controlSymbol as any;
					delete field.controlSymbol;
					fieldsChanged = true;
				}

				for (const option of field.options ?? []) {
					if ("symbol" in option) {
						option.icon = option.symbol as any;
						delete option.symbol;
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

		await this.backend.meta.setMeta("fieldIconsMigrationCompleted", "1");
	}

	/** Rename Pad to Map in History.type */
	async _historyPadMigration(): Promise<void> {
		if(await this.backend.meta.getMeta("historyPadMigrationCompleted") == "1")
			return;

		console.log("DB migration: Rename Pad to Map in History.type");

		const queryInterface = this.backend._conn.getQueryInterface();

		await queryInterface.changeColumn("History", "type", DataTypes.STRING(20));

		await this.backend.history.HistoryModel.update({ type: "Map" }, { where: { type: "Pad" } });

		await queryInterface.changeColumn("History", "type", this.backend.history.HistoryModel.getAttributes().type);

		await this.backend.meta.setMeta("historyPadMigrationCompleted", "1");
	}

	/** Rename Map.id to Map.readId and create Map.id */
	async _mapIdMigration(): Promise<void> {
		const queryInterface = this.backend._conn.getQueryInterface();

		let mapIdMigrationCompleted = await this.backend.meta.getMeta("mapIdMigrationCompleted");

		if (mapIdMigrationCompleted == null) {
			// For this migration we need the readId column. It was added at some point and later removed again.
			// If we are starting this migration at a point _before_ the readId column, we need to temporarily add it so that the migration will be run.
			// It will then be deleted again by the mapLinkMigration below.
			const attributes = await queryInterface.describeTable(this.backend.maps.MapModel.getTableName());
			if (!attributes.readId) {
				console.log(`DB migration: Temporarily add column ${this.backend.maps.MapModel.getTableName() as string}.readId`);
				await queryInterface.addColumn(this.backend.maps.MapModel.getTableName(), "readId", { type: DataTypes.STRING, allowNull: false });
			}

			console.log("DB migration: Copy values of Map.id to Map.readId");
			await queryInterface.bulkUpdate("Maps", { readId: col("id") }, {});

			// We store this completion separately so that if the migration aborts later while generating new IDs, we don't copy
			// those new IDs to readId on the next run.
			await this.backend.meta.setMeta("mapIdMigrationCompleted", "1");
			mapIdMigrationCompleted = "1";
		}

		if (mapIdMigrationCompleted === "1") {
			console.log("DB migration: Generate values for Map.id");

			// Copy back readId to id, in case the last ID generation failed (otherwise the ID generation below would crash with duplicate
			// primary keys).
			// We prefix the ID so that existing IDs that happen to be a number don't collide with the IDs we generate.
			await queryInterface.bulkUpdate("Maps", { id: fn("concat", "-", col("readId")) }, {});

			const maps = await this.backend.maps.MapModel.findAll({
				attributes: ["id"]
			});

			// First generate increasing ID numbers as strings in the existing column
			for (let i = 0; i < maps.length; i++) {
				await this.backend.maps.MapModel.update({
					id: `${i + 1}` as any
				}, {
					where: {
						id: maps[i].id
					}
				});
			}

			await this.backend.meta.setMeta("mapIdMigrationCompleted", "2");
			mapIdMigrationCompleted = "2";
		}

		if (mapIdMigrationCompleted === "2") {
			// We cannot change the type of Map.id, since there are foreign key constraints.
			// We need to remove the foreign keys and add them back later
			console.log("DB migration: Delete mapId foreign keys");
			for (const tableName of ["Markers", "Lines", "Types", "Views", "History"]) {
				for (const foreignKey of await queryInterface.getForeignKeyReferencesForTable(tableName) as any[]) {
					if (foreignKey.columnName === "mapId") {
						await queryInterface.removeConstraint(tableName, foreignKey.constraintName);
					}
				}
			}

			// Then convert the ID field to an integer. We need to omit the primary key field here, as the field is already the
			// primary key, and adding the statement again will lead to "ERROR 1068 (42000): Multiple primary key defined".
			console.log("DB migration: Change Map.id to integer");
			await queryInterface.changeColumn("Maps", "id", omit(this.backend.maps.MapModel.getAttributes().id, ["primaryKey"]));

			console.log("DB migration: Add back mapId foreign keys");
			for (const tableName of ["Markers", "Lines", "Types", "Views", "History"]) {
				await queryInterface.changeColumn(tableName, "mapId", { type: DataTypes.INTEGER.UNSIGNED });

				if (!(await queryInterface.getForeignKeyReferencesForTable(tableName) as any[]).some((v) => v.columnName === "mapId")) {
					await queryInterface.addConstraint(tableName, {
						fields: ["mapId"],
						type: "foreign key",
						references: {
							table: "Maps",
							field: "id"
						},
						onUpdate: "CASCADE",
						onDelete: "CASCADE"
					});
				}
			}

			console.log("DB migration: Rename Map.id to Map.readId in history");
			const historyEntries = await this.backend.history.HistoryModel.findAll({
				where: { type: "Map" },
				attributes: ["id", "objectBefore", "objectAfter"]
			});
			for (const historyEntry of historyEntries) {
				if (historyEntry.objectBefore && (historyEntry.objectBefore as any).id) {
					historyEntry.objectBefore = {
						...omit(historyEntry.objectBefore as any, ["id"]),
						readId: (historyEntry.objectBefore as any).id
					} as any;
				}

				if (historyEntry.objectAfter && (historyEntry.objectAfter as any).id) {
					historyEntry.objectAfter = {
						...omit(historyEntry.objectAfter as any, ["id"]),
						readId: (historyEntry.objectAfter as any).id
					} as any;
				}

				await historyEntry.save();
			}

			await this.backend.meta.setMeta("mapIdMigrationCompleted", "3");
			mapIdMigrationCompleted = "3";
		}
	}


	/** Change marker/line data key from field name to field ID */
	async _fieldIdMigration(): Promise<void> {
		const queryInterface = this.backend._conn.getQueryInterface();
		const markerDataAttrs = await queryInterface.describeTable(this.backend.markers.MarkerDataModel.getTableName());
		const lineDataAttrs = await queryInterface.describeTable(this.backend.lines.LineDataModel.getTableName());

		if (!markerDataAttrs.name && !lineDataAttrs.name) {
			return;
		}

		console.log("DB migration: Introduce field IDs");

		if (markerDataAttrs.name && lineDataAttrs.name) {
			const nextFieldId: Record<ID, ID> = {};

			const allTypes = await this.backend.types.TypeModel.findAll({
				attributes: ["id", "mapId", "type", "fields"]
			});

			for (let i = 0; i < allTypes.length; i++) {
				if ((i + 1) % 500 === 0) {
					console.log(`DB migration: Introduce field IDs (${i + 1} / ${allTypes.length})`);
				}

				const type = allTypes[i];
				const fields = type.fields;
				const fieldMap: Record<string, ID> = Object.create(null);
				let fieldsChanged = false;
				for (const field of fields) {
					if (field.id) { // Field ID was already set in a previous migration attempt
						nextFieldId[type.mapId] = nextFieldId[type.mapId] ? Math.max(nextFieldId[type.mapId], field.id) : field.id;
					} else {
						field.id = nextFieldId[type.mapId] ?? 1;
						nextFieldId[type.mapId] = field.id + 1;
						fieldsChanged = true;
					}
					fieldMap[field.name] = field.id;
				}

				if (fieldsChanged) {
					await type.update({ fields });
				}

				for (const historyEntry of await this.backend.history.HistoryModel.findAll({ where: { type: "Type", objectId: type.id } })) {
					let entryChanged = false;
					for (const field of [...(historyEntry.objectBefore as Type | undefined)?.fields ?? [], ...(historyEntry.objectAfter as Type | undefined)?.fields ?? []]) {
						if (fieldMap[field.name]) {
							if (field.id !== fieldMap[field.name]) {
								field.id = fieldMap[field.name];
								entryChanged = true;
							}
						} else {
							if (field.id) {
								nextFieldId[type.mapId] = nextFieldId[type.mapId] ? Math.max(nextFieldId[type.mapId], field.id) : field.id;
							} else {
								field.id = nextFieldId[type.mapId] ?? 1;
								nextFieldId[type.mapId] = field.id + 1;
								entryChanged = true;
							}
							fieldMap[field.name] = field.id;
						}
					}
					if (entryChanged) {
						await historyEntry.update({ objectBefore: historyEntry.objectBefore, objectAfter: historyEntry.objectAfter });
					}
				}

				if (type.type === "marker") {
					const markerIds = (await this.backend.markers.MarkerModel.findAll({ where: { typeId: type.id }, attributes: ["id"] })).map((m) => m.id);

					for (const [name, id] of Object.entries(fieldMap)) {
						await this.backend.markers.MarkerDataModel.update({ fieldId: id }, { where: { markerId: { [Op.in]: markerIds }, ["name" as any]: name } });
					}

					for (const historyEntry of await this.backend.history.HistoryModel.findAll({ where: { type: "Marker", objectId: { [Op.in]: markerIds } } })) {
						if (historyEntry.objectBefore) {
							historyEntry.objectBefore = { // Must overwrite whole objectBefore property, as it is stringified
								...historyEntry.objectBefore,
								data: Object.fromEntries(Object.entries((historyEntry.objectBefore as RawMarker).data).map(([k, v]) => [fieldMap[k] ?? k, v]))
							};
						}
						if (historyEntry.objectAfter) {
							historyEntry.objectAfter = { // Must overwrite whole objectAfter property, as it is stringified
								...historyEntry.objectAfter,
								data: Object.fromEntries(Object.entries((historyEntry.objectAfter as RawMarker).data).map(([k, v]) => [fieldMap[k] ?? k, v]))
							};
						}
						await historyEntry.update({ objectBefore: historyEntry.objectBefore, objectAfter: historyEntry.objectAfter });
					}
				} else if (type.type === "line") {
					const lineIds = (await this.backend.lines.LineModel.findAll({ where: { typeId: type.id }, attributes: ["id"] })).map((l) => l.id);

					for (const [name, id] of Object.entries(fieldMap)) {
						await this.backend.lines.LineDataModel.update({ fieldId: id }, { where: { lineId: { [Op.in]: lineIds }, ["name" as any]: name } });
					}

					for (const historyEntry of await this.backend.history.HistoryModel.findAll({ where: { type: "Line", objectId: { [Op.in]: lineIds } } })) {
						if (historyEntry.objectBefore) {
							(historyEntry.objectBefore as RawLine).data = Object.fromEntries(Object.entries((historyEntry.objectBefore as RawLine).data).map(([k, v]) => [fieldMap[k] ?? k, v]));
						}
						if (historyEntry.objectAfter) {
							(historyEntry.objectAfter as RawLine).data = Object.fromEntries(Object.entries((historyEntry.objectAfter as RawLine).data).map(([k, v]) => [fieldMap[k] ?? k, v]));
						}
						await historyEntry.update({ objectBefore: historyEntry.objectBefore, objectAfter: historyEntry.objectAfter });
					}
				}
			}


			const allMaps = await this.backend.maps.MapModel.findAll({ attributes: ["id"] });
			for (const map of allMaps) {
				await map.update({
					nextFieldId: nextFieldId[map.id] ?? 1
				});
			}
		}

		await queryInterface.removeColumn(this.backend.markers.MarkerDataModel.getTableName(), "name");
		await queryInterface.removeColumn(this.backend.lines.LineDataModel.getTableName(), "name");

		console.log("DB migration: Introduce field IDs finished");
	}


	async _mapLinkMigration(): Promise<void> {
		const queryInterface = this.backend._conn.getQueryInterface();
		const attrs = await queryInterface.describeTable(this.backend.maps.MapModel.getTableName());

		if (!attrs["readId"] && !attrs["writeId"] && !attrs["adminId"] && !attrs["searchEngines"]) {
			return;
		}

		console.log("DB migration: Create map link table");

		// If some ID columns are already missing, the previous migration attempt aborted while deleting columns. This means
		// that the MapLinks table is already ready.
		if (attrs["readId"] && attrs["writeId"] && attrs["adminId"] && attrs["searchEngines"]) {
			const allMaps = await this.backend.maps.MapModel.findAll({
				attributes: ["id", "salt", "jwtSecret", "readId", "writeId", "adminId", "searchEngines"]
			});

			for (const map of allMaps) {
				if (!map.salt || !map.jwtSecret) {
					await map.update({
						...!map.salt ? {
							salt: createSalt()
						} : {},
						...!map.jwtSecret ? {
							jwtSecret: createJwtSecret()
						} : {}
					});
				}
			}

			const existingMapLinks = new Set((await this.backend.maps.MapLinkModel.findAll({ attributes: ["slug"] })).map((l) => l.slug));

			await forEachAsync(allMaps, async (map, i) => {
				if ((i + 1) % 1000 === 0) {
					console.log(`DB migration: Create map link table (${i + 1} / ${allMaps.length})`);
				}

				for (const [slug, comment, searchEngines, permissions] of [
					[map.getDataValue("adminId" as any), ADMIN_LINK_COMMENT, false, { read: true, update: true, settings: true, admin: true } satisfies MapPermissions],
					[map.getDataValue("writeId" as any), WRITE_LINK_COMMENT, false, { read: true, update: true, settings: false, admin: false } satisfies MapPermissions],
					[map.getDataValue("readId" as any), READ_LINK_COMMENT, !!map.getDataValue("searchEngines" as any), { read: true, update: false, settings: false, admin: false } satisfies MapPermissions]
				] as const) {
					if (!existingMapLinks.has(slug)) {
						await this.backend.maps.MapLinkModel.create({
							mapId: map.id,
							slug,
							readToken: await createMapToken({
								mapId: map.id,
								slugHash: getSlugHash(slug, map.salt),
								permissions: { read: true, update: false, settings: false, admin: false }
							}, map.jwtSecret),
							comment,
							password: null,
							permissions,
							searchEngines
						});
					}
				}
			}, 8); // Maximum concurrency is 4 by default, can be increased through UV_THREADPOOL_SIZE, see https://nodejs.org/dist/latest-v16.x/docs/api/cli.html#uv_threadpool_sizesize
		}

		// Delete adminId before writeId to avoid problem in _renameColMigrations() (renames writeId to adminId
		// if writeId exists and adminId doesn't) if this aborts in the middle.
		if (attrs["adminId"]) {
			await queryInterface.removeColumn(this.backend.maps.MapModel.getTableName(), "adminId");
		}
		if (attrs["writeId"]) {
			await queryInterface.removeColumn(this.backend.maps.MapModel.getTableName(), "writeId");
		}
		if (attrs["readId"]) {
			await queryInterface.removeColumn(this.backend.maps.MapModel.getTableName(), "readId");
		}
		if (attrs["searchEngines"]) {
			await queryInterface.removeColumn(this.backend.maps.MapModel.getTableName(), "searchEngines");
		}

		console.log("DB migration: Create map link table finished");
	}

}
