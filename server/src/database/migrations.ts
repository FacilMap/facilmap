import { clone, generateRandomId, promiseProps } from "../utils/utils";
import { streamEachPromise } from "../utils/streams";
import Sequelize from "sequelize";
import { isEqual } from "lodash";
import Database from "./database";
import { PadModel } from "./pad";
import { Line, Marker } from "facilmap-types";
import { LinePointModel } from "./line";
import { getElevationForPoints } from "../elevation";

const Op = Sequelize.Op;

export default class DatabaseMigrations {

	_db: Database;

	constructor(database: Database) {
		this._db = database;
	}

	async _runMigrations(): Promise<void> {
		const queryInterface = this._db._conn.getQueryInterface();

		const renameColMigrations = Promise.all([
			queryInterface.describeTable('Lines').then((attributes: any) => {
				const promises: Promise<any>[] = [ ];

				// Rename Line.points to Line.routePoints
				if(attributes.points) {
					promises.push(queryInterface.renameColumn('Lines', 'points', 'routePoints'));
				}

				// Change routing type "shortest" / "fastest" to "car", add type "track"
				if(attributes.mode.type.indexOf("shortest") != -1)
					promises.push(this._db.lines.LineModel.update({ mode: "car" }, { where: { mode: { [Op.in]: [ "fastest", "shortest" ] } } }));

				return Promise.all(promises);
			}),

			queryInterface.describeTable('Pads').then((attributes: any) => {
				// Rename writeId to adminId

				if(!attributes.adminId) {
					const Pad = this._db.pads.PadModel;
					return queryInterface.renameColumn('Pads', 'writeId', 'adminId').then(() => {
						return queryInterface.addColumn('Pads', 'writeId', Pad.rawAttributes.writeId);
					}).then(() => {
						return Pad.findAll<PadModel>();
					}).then((pads) => {
						let promise: Promise<any> = Promise.resolve();
						for(const pad of pads) {
							const genId = (): Promise<string> => {
								const writeId = generateRandomId(14);
								return this._db.pads.padIdExists(writeId).then((exists) => {
									if(exists)
										return genId();
									else
										return writeId;
								});
							};

							promise = promise.then(() => {
								return genId();
							}).then((writeId) => {
								return Pad.update({writeId}, { where: { id: pad.id } });
							});
						}
						return promise;
					});
				}
			})
		]);

		const changeColMigrations = Promise.all([ 'Pads', 'Markers', 'Lines', 'Types' ].map(async (table) => {
			const attributes: any = await queryInterface.describeTable(table);

			// allow null on Pad.name, Marker.name, Line.name
			if(["Pads", "Markers", "Lines"].includes(table) && !attributes.name.allowNull)
				await queryInterface.changeColumn(table, 'name', { type: Sequelize.TEXT, allowNull: true });

			// Change routing mode field from ENUM to TEXT
			if(table == "Lines" && attributes.mode.type != "TEXT")
				await queryInterface.changeColumn(table, "mode", { type: Sequelize.TEXT, allowNull: false, defaultValue: "" });
			if(table == "Types" && attributes.defaultMode.type != "TEXT")
				await queryInterface.changeColumn(table, "defaultMode", { type: Sequelize.TEXT, allowNull: true });
		}));

		const addColMigrations = renameColMigrations.then(() => {
			return Promise.all([ 'Pad', 'Marker', 'Type', 'View', 'Line', 'LinePoint' ].map((table) => {
				const model = this._db._conn.model(table);
				return queryInterface.describeTable(model.getTableName()).then((attributes: any) => {
					const promises = [ ];
					for(const attribute in model.rawAttributes) {
						if(!attributes[attribute])
							promises.push(queryInterface.addColumn(model.getTableName(), attribute, model.rawAttributes[attribute]));
					}
					return Promise.all(promises);
				});
			}));
		});

		// Get rid of the dropdown key, save the value in the data instead
		const dropdownKeyMigration = this._db.meta.getMeta("dropdownKeysMigrated").then((dropdownKeysMigrated) => {
			if(dropdownKeysMigrated == "true")
				return;

			return this._db.types.TypeModel.findAll().then((types) => {
				let operations = Promise.resolve();
				for(const type of types) {
					const newFields = type.fields; // type.fields is a getter, we cannot modify the object directly
					const dropdowns = newFields.filter((field) => field.type == "dropdown");
					if(dropdowns.length > 0) {
						operations = operations.then(() => {
							const objectStream = (type.type == "line" ? this._db.lines.getPadLinesByType(type.padId, type.id) : this._db.markers.getPadMarkersByType(type.padId, type.id)) as Highland.Stream<Marker | Line>;

							return streamEachPromise(objectStream, (object) => {
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
						}).then(() => {
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
							return this._db.helpers._updatePadObject("Type", type.padId, type.id, {fields: newFields}, true);
						});
					}
				}
				return operations;
			}).then(() => {
				return this._db.meta.setMeta("dropdownKeysMigrated", "true");
			});
		});

		// Get elevation data for all lines/markers that don't have any yet
		const elevationMigration = addColMigrations.then(() => {
			return this._db.meta.getMeta("hasElevation");
		}).then((hasElevation) => {
			if(hasElevation == "true")
				return;

			return Promise.all([
				this._db.lines.LineModel.findAll().then((lines) => {
					let operations = Promise.resolve();
					for(const line of lines) {
						operations = operations.then(() => {
							return this._db.lines.LineModel.build({ id: line.id }).getLinePoints().then((trackPoints) => {
								return this._db.lines._setLinePoints(line.padId, line.id, trackPoints, true);
							});
						});
					}
					return operations;
				}),
				this._db.markers.MarkerModel.findAll({where: {ele: null}}).then((markers) => {
					return getElevationForPoints(markers).then((elevations) => {
						let operations = Promise.resolve();
						markers.forEach((marker, i) => {
							operations = operations.then(() => {
								return this._db.helpers._updatePadObject("Marker", marker.padId, marker.id, {ele: elevations[i]}, true);
							});
						});
						return operations;
					});
				})
			]).then(() => {
				return this._db.meta.setMeta("hasElevation", "true");
			});
		});


		// Add showInLegend field to types
		const legendMigration = addColMigrations.then(() => (this._db.meta.getMeta("hasLegendOption"))).then((hasLegendOption) => {
			if(hasLegendOption == "true")
				return;

			return this._db.types.TypeModel.findAll().then((types) => {
				let operations = Promise.resolve();
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

					operations = operations.then(() => (this._db.helpers._updatePadObject("Type", type.padId, type.id, { showInLegend }, true)));
				}
				return operations;
			}).then(() => (this._db.meta.setMeta("hasLegendOption", "true")));
		});


		// Calculate bounding box for lines
		const bboxMigration = addColMigrations.then(async () => {
			if(await this._db.meta.getMeta("hasBboxes") == "true")
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

			await this._db.meta.setMeta("hasBboxes", "true");
		});

		await Promise.all([ renameColMigrations, changeColMigrations, addColMigrations, dropdownKeyMigration, elevationMigration, legendMigration, bboxMigration ]);
	}
}
