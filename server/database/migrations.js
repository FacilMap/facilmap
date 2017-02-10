var Sequelize = require("sequelize");

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

				/*queryInterface.describeTable('Markers').then(function(attributes) {
					var promises = [ ];

					// Add size and symbol columns
					if(!attributes.size)
						promises.push(queryInterface.addColumn('Markers', 'size', Marker.attributes.size));
					if(!attributes.symbol)
						promises.push(queryInterface.addColumn('Markers', 'symbol', Marker.attributes.symbol));

					return Promise.all(promises);
				}),

				queryInterface.describeTable('Types').then(function(attributes) {
					return Promise.all([ 'defaultColour', 'colourFixed', 'defaultSize', 'sizeFixed', 'defaultSymbol', 'symbolFixed', 'defaultWidth', 'widthFixed', 'defaultMode', 'modeFixed' ].map(function(col) {
						if(!attributes[col])
							return queryInterface.addColumn('Types', col, Type.attributes[col]);
					}));
				}),

				queryInterface.describeTable('Views').then(function(attributes) {
					if(!attributes.filter)
						return queryInterface.addColumn('Views', 'filter', View.attributes.filter);
				})*/
			});

			return Promise.all([ renameColMigrations, changeColMigrations, addColMigrations ]);
		}
	});
};