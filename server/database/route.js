var highland = require("highland");
var Promise = require("bluebird");
var Sequelize = require("sequelize");
var underscore = require("underscore");

var elevation = require("../elevation");
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

			let ret = new utils.ArrayStream();

			this._conn.model("RoutePoint").findAll({
				where: cond,
				attributes: [ "lon", "lat", "idx", "ele"],
				order: "idx"
			}).then((objs) => {
				ret.receiveArray(null, objs);
			}).catch((err) => {
				ret.receiveArray(err);
			});

			return ret;
		},

		createRoute(routePoints, mode, calculateElevation) {
			// TODO: Check if exists
			let routeId = utils.generateRandomId(20);

			return this.updateRoute(routeId, routePoints, mode, calculateElevation, true);
		},

		updateRoute(routeId, routePoints, mode, calculateElevation, _noClear) {
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
				elevation: (trackPoints) => {
					if(thisTime < updateTimes[routeId])
						return;

					if(calculateElevation) {
						return this._updateElevation(trackPoints).then((ascentDescent) => {
							Object.assign(line, ascentDescent);
						});
					}
				},
				update: (clear, trackPoints, elevation) => {
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

		deleteRoute(routeId) {
			delete updateTimes[routeId];

			return this._conn.model("RoutePoint").destroy({
				where: {
					routeId
				}
			}).then(() => {});
		},

		getRoutePointsByIdx(routeId, indexes) {
			let ret = new utils.ArrayStream();

			this._conn.model("RoutePoint").findAll({
				where: { routeId, idx: indexes },
				attributes: [ "lon", "lat", "idx", "ele" ],
				order: "idx"
			}).then((objs) => {
				ret.receiveArray(null, objs);
			}).catch((err) => {
				ret.receiveArray(err);
			});

			return ret;
		}
	});
};