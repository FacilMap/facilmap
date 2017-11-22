var highland = require("highland");
var Promise = require("bluebird");
var Sequelize = require("sequelize");
var underscore = require("underscore");

var utils = require("../utils");
var routing = require("../routing");

let updateTimes = {};

module.exports = function(Database) {
	Database.prototype._init.push(function() {
		this._conn.define("RoutePoint", {
			routeId: { type: Sequelize.STRING, allowNull: false },
			lat: this._TYPES.lat,
			lon: this._TYPES.lon,
			zoom: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, validate: { min: 1, max: 20 } },
			idx: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
			ele: { type: Sequelize.INTEGER, allowNull: true }
		});
	});

	// TODO: Clean all routes on start

	// =====================================================================================================================

	utils.extend(Database.prototype, {
		getRoutePoints(routeId, bboxWithZoom, getCompleteBasicRoute) {
			let cond = {
				routeId,
				$or: [ this._makeBboxCondition(bboxWithZoom) ]
			};

			if(bboxWithZoom)
				cond.$or[0] = Sequelize.and(cond.$or[0], { zoom: { lte: bboxWithZoom.zoom } });

			if(getCompleteBasicRoute)
				cond.$or.push({ zoom: { lte: 5 } });

			return this._conn.model("RoutePoint").findAll({
				where: cond,
				attributes: [ "lon", "lat", "idx", "ele"],
				order: "idx"
			});
		},

		generateRouteId() {
			// TODO: Check if exists
			return Promise.resolve(utils.generateRandomId(20));
		},

		createRoute(routePoints, mode) {
			return this.generateRouteId().then((routeId) => {
				return this.updateRoute(routeId, routePoints, mode, true);
			});
		},

		updateRoute(routeId, routePoints, mode, _noClear) {
			let line = { id: routeId, mode, routePoints };

			let thisTime = Date.now();

			return utils.promiseAuto({
				clear: () => {
					if(!_noClear)
						return this.deleteRoute(routeId);

					return this._conn.model("RoutePoint").destroy({
						where: { routeId }
					});
				},
				trackPoints: () => {
					if(thisTime < updateTimes[routeId])
						return;

					return this._calculateRouting(line);
				},
				update: (clear, trackPoints) => {
					if(thisTime < updateTimes[routeId])
						return;

					let create = [ ];
					for(let trackPoint of trackPoints) {
						create.push(Object.assign(JSON.parse(JSON.stringify(trackPoint)), { routeId: routeId }));
					}

					return this._bulkCreateInBatches(this._conn.model("RoutePoint"), create);
				}
			}).then((res) => {
				if(thisTime < updateTimes[routeId])
					return;

				updateTimes[routeId] = thisTime;

				line.trackPoints = res.trackPoints;

				return line; // Contains also distance, time, ascent, descent properties
			});
		},

		lineToRoute(routeId, padId, lineId) {
			return utils.promiseAuto({
				routeId: () => (routeId ? routeId : this.generateRouteId()),
				clear: () => {
					if(routeId) {
						return this._conn.model("RoutePoint").destroy({
							where: { routeId }
						});
					}
				},
				line: () => (this.getLine(padId, lineId)),
				linePoints: () => (this.getAllLinePoints(lineId)),
				update: (routeId, clear, line, linePoints) => {
					let create = [];
					for(let linePoint of linePoints) {
						create.push({
							routeId,
							lat: linePoint.lat,
							lon: linePoint.lon,
							ele: linePoint.ele,
							zoom: linePoint.zoom,
							idx: linePoint.idx
						});
					}

					return this._bulkCreateInBatches(this._conn.model("RoutePoint"), create);
				}

			}).then((res) => {
				updateTimes[res.routeId] = Date.now();

				return {
					id: res.routeId,
					mode: res.line.mode,
					routePoints: res.line.routePoints,
					trackPoints: res.linePoints,
					distance: res.line.distance,
					time: res.line.time,
					ascent: res.line.ascent,
					descent: res.line.descent
				};
			});
		},

		deleteRoute(routeId) {
			delete updateTimes[routeId];

			return this._conn.model("RoutePoint").destroy({
				where: {
					routeId
				}
			}).then(() => {});
		},

		getRoutePointsByIdx(routeId, indexes) {
			return this._conn.model("RoutePoint").findAll({
				where: { routeId, idx: indexes },
				attributes: [ "lon", "lat", "idx", "ele" ],
				order: "idx"
			});
		},

		getAllRoutePoints(routeId) {
			return this._conn.model("RoutePoint").findAll({
				where: {routeId},
				attributes: [ "lon", "lat", "idx", "ele", "zoom"]
			});
		}
	});
};