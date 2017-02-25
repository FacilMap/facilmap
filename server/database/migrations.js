var Sequelize = require("sequelize");
var underscore = require("underscore");

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
				return Promise.all([ 'Pad', 'Marker', 'Type', 'View' ].map((table) => {
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
					this.setMeta("dropdownKeysMigrated", true);
				});
			});

			return Promise.all([ renameColMigrations, changeColMigrations, addColMigrations/*, dropdownKeyMigration*/ ]);
		}
	});
};