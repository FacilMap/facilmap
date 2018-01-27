var Promise = require("bluebird");
var Sequelize = require("sequelize");
var underscore = require("underscore");

var elevation = require("../elevation");
var utils = require("../utils");

module.exports = function(Database) {
	utils.extend(Database.prototype, {
		_runMigrations() {
			var queryInterface = this._conn.getQueryInterface();

			var renameColMigrations = Promise.all([
				queryInterface.describeTable('Lines').then((attributes) => {
					var promises = [ ];

					// Rename Line.points to Line.routePoints
					if(attributes.points) {
						promises.push(queryInterface.renameColumn('Lines', 'points', 'routePoints'));
					}

					// Change routing type "shortest" / "fastest" to "car", add type "track"
					if(attributes.mode.type.indexOf("shortest") != -1) {
						promises.push(
							Promise.resolve().then(() => {
								return queryInterface.changeColumn('Lines', 'mode', {
									type: Sequelize.ENUM("", "shortest", "fastest", "car", "bicycle", "pedestrian"), allowNull: false, defaultValue: ""
								});
							}).then(() => {
								return this._conn.model("Line").update({ mode: "car" }, { where: { mode: { $in: [ "fastest", "shortest" ] } } });
							}).then(() => {
								return queryInterface.changeColumn('Lines', 'mode', {
									type: Sequelize.ENUM("", "car", "bicycle", "pedestrian", "track"), allowNull: false, defaultValue: ""
								});
							})
						);
					}

					return Promise.all(promises);
				}),

				queryInterface.describeTable('Pads').then((attributes) => {
					// Rename writeId to adminId

					if(!attributes.adminId) {
						let Pad = this._conn.model('Pad');
						return queryInterface.renameColumn('Pads', 'writeId', 'adminId').then(() => {
							return queryInterface.addColumn('Pads', 'writeId', Pad.attributes.writeId);
						}).then(() => {
							return Pad.findAll();
						}).then((pads) => {
							let promise = Promise.resolve();
							for(let pad of pads) {
								let genId = () => {
									let writeId = utils.generateRandomId(14);
									return this.padIdExists(writeId).then((exists) => {
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

			var changeColMigrations = Promise.all([ 'Pads', 'Markers', 'Lines' ].map((table) => {
				// allow null on Pad.name, Marker.name, Line.name
				return queryInterface.describeTable(table).then((attributes) => {
					if(!attributes.name.allowNull)
						return queryInterface.changeColumn(table, 'name', { type: Sequelize.TEXT, allowNull: true });
				});
			}));

			var addColMigrations = renameColMigrations.then(() => {
				return Promise.all([ 'Pad', 'Marker', 'Type', 'View', 'Line', 'LinePoint' ].map((table) => {
					var model = this._conn.model(table);
					return queryInterface.describeTable(model.getTableName()).then((attributes) => {
						var promises = [ ];
						for(var attribute in model.attributes) {
							if(!attributes[attribute])
								promises.push(queryInterface.addColumn(model.getTableName(), attribute, model.attributes[attribute]));
						}
						return Promise.all(promises);
					});
				}));
			});

			// Get rid of the dropdown key, save the value in the data instead
			let dropdownKeyMigration = this.getMeta("dropdownKeysMigrated").then((dropdownKeysMigrated) => {
				if(dropdownKeysMigrated)
					return;

				return this._conn.model("Type").findAll().then((types) => {
					let operations = Promise.resolve();
					for(let type of types) {
						let newFields = type.fields; // type.fields is a getter, we cannot modify the object directly
						let dropdowns = newFields.filter((field) => field.type == "dropdown");
						if(dropdowns.length > 0) {
							operations = operations.then(() => {
								let objectStream = type.type == "line" ? this.getPadLinesByType(type.padId, type.id) : this.getPadMarkersByType(type.padId, type.id);

								return utils.streamEachPromise(objectStream, (object) => {
									let newData = underscore.clone(object.data);
									for(let dropdown of dropdowns) {
										let newVal = (dropdown.options || {}).filter((option) => option.key == newData[dropdown.name])[0];
										if(newVal)
											newData[dropdown.name] = newVal.value;
										else if(newData[dropdown.name])
											console.log(`Warning: Dropdown key ${newData[dropdown.name]} for field ${dropdown.name} of type ${type.name} of pad ${type.padId} does not exist.`);
									}

									if(!underscore.isEqual(newData, object.data))
										return this._updatePadObject(type.type == "line" ? "Line" : "Marker", object.padId, object.id, {data: newData}, true);
								});
							}).then(() => {
								dropdowns.forEach((dropdown) => {
									if(dropdown.default) {
										let newDefault = dropdown.options.filter((option) => (option.key == dropdown.default))[0];
										if(newDefault)
											dropdown.default = newDefault.value;
										else
											console.log(`Warning: Default dropdown key ${dropdown.default} for field ${dropdown.name} of type ${type.name} of pad ${type.padId} does not exist.`);
									}

									dropdown.options.forEach((option) => {
										delete option.key;
									});
								});
								return this._updatePadObject("Type", type.padId, type.id, {fields: newFields}, true);
							});
						}
					}
					return operations;
				}).then(() => {
					return this.setMeta("dropdownKeysMigrated", true);
				});
			});

			// Get elevation data for all lines/markers that don't have any yet
			let elevationMigration = addColMigrations.then(() => {
				return this.getMeta("hasElevation");
			}).then((hasElevation) => {
				if(hasElevation)
					return;

				return Promise.all([
					this._conn.model("Line").findAll().then((lines) => {
						let operations = Promise.resolve();
						for(let line of lines) {
							operations = operations.then(() => {
								return this._conn.model("Line").build({ id: line.id }).getLinePoints().then((trackPoints) => {
									return this._setLinePoints(line.padId, line.id, trackPoints, true);
								});
							});
						}
						return operations;
					}),
					this._conn.model("Marker").findAll({where: {ele: null}}).then((markers) => {
						return elevation.getElevationForPoints(markers).then((elevations) => {
							let operations = Promise.resolve();
							markers.forEach((marker, i) => {
								operations = operations.then(() => {
									return this._updatePadObject("Marker", marker.padId, marker.id, {ele: elevations[i]}, true);
								});
							});
							return operations;
						});
					})
				]).then(() => {
					return this.setMeta("hasElevation", true);
				});
			});


			// Add showInLegend field to types
			let legendMigration = addColMigrations.then(() => (this.getMeta("hasLegendOption"))).then((hasLegendOption) => {
				if(hasLegendOption)
					return;

				return this._conn.model("Type").findAll().then((types) => {
					let operations = Promise.resolve();
					for(let type of types) {
						let showInLegend = false;

						if(type.colourFixed || (type.type == "marker" && type.symbolFixed && type.defaultSymbol) || (type.type == "marker" && type.shapeFixed) || (type.type == "line" && type.widthFixed))
							showInLegend = true;

						if(!showInLegend) {
							for(let field of type.fields) {
								if((field.type == "dropdown" || field.type == "checkbox") && (field.controlColour || (type.type == "marker" && field.controlSymbol) || (type.type == "marker" && field.controlShape) || (type.type == "line" && field.controlWidth))) {
									showInLegend = true;
									break;
								}
							}
						}

						operations = operations.then(() => (this._updatePadObject("Type", type.padId, type.id, { showInLegend }, true)));
					}
					return operations;
				}).then(() => (this.setMeta("hasLegendOption", true)));
			});


			return Promise.all([ renameColMigrations, changeColMigrations, addColMigrations, dropdownKeyMigration, elevationMigration, legendMigration ]);
		}
	});
};