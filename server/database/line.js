var highland = require("highland");
var Promise = require("bluebird");
var Sequelize = require("sequelize");
var underscore = require("underscore");

var elevation = require("../elevation");
var utils = require("../utils");
var routing = require("../routing");

module.exports = function(Database) {
	Database.prototype._init.push(function() {
		this._conn.define("Line", {
			routePoints : {
				type: Sequelize.TEXT,
				allowNull: false,
				get: function() {
					var routePoints = this.getDataValue("routePoints");
					return routePoints != null ? JSON.parse(routePoints) : routePoints;
				},
				set: function(v) {
					for(var i=0; i<v.length; i++) {
						v[i].lat = 1*v[i].lat.toFixed(6);
						v[i].lon = 1*v[i].lon.toFixed(6);
					}
					this.setDataValue("routePoints", JSON.stringify(v));
				},
				validate: {
					minTwo: function(val) {
						var routePoints = JSON.parse(val);
						if(!Array.isArray(routePoints))
							throw new Error("routePoints is not an array");
						if(routePoints.length < 2)
							throw new Error("A line cannot have less than two route points.");
					}
				}
			},
			mode : { type: Sequelize.ENUM("", "car", "bicycle", "pedestrian", "track"), allowNull: false, defaultValue: "" },
			colour : { type: Sequelize.STRING(6), allowNull: false, defaultValue: "0000ff", validate: this._TYPES.validateColour },
			width : { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 4, validate: { min: 1 } },
			name : { type: Sequelize.TEXT, allowNull: true, get: function() { return this.getDataValue("name") || "Untitled line"; } },
			distance : { type: Sequelize.FLOAT(24, 2).UNSIGNED, allowNull: true },
			time : { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
			ascent : { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
			descent : { type: Sequelize.INTEGER.UNSIGNED, allowNull: true }
		});

		this._conn.define("LinePoint", {
			lat: this._TYPES.lat,
			lon: this._TYPES.lon,
			zoom: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, validate: { min: 1, max: 20 } },
			idx: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
			ele: { type: Sequelize.INTEGER, allowNull: true }
		});

		this._conn.define("LineData", this._TYPES.dataDefinition);
	});

	Database.prototype._afterInit.push(function() {
		var Line = this._conn.model("Line");
		var LinePoint = this._conn.model("LinePoint");
		var LineData = this._conn.model("LineData");

		Line.belongsTo(this._conn.model("Pad"), this._makeNotNullForeignKey("pad", "padId"));
		this._conn.model("Pad").hasMany(Line, { foreignKey: "padId" });

		// TODO: Cascade
		Line.belongsTo(this._conn.model("Type"), this._makeNotNullForeignKey("type", "typeId", true));

		LinePoint.belongsTo(Line, this._makeNotNullForeignKey("line", "lineId"));
		Line.hasMany(LinePoint, { foreignKey: "lineId" });

		LineData.belongsTo(Line, this._makeNotNullForeignKey("line", "lineId"));
		Line.hasMany(LineData, { foreignKey: "lineId" });
	});

	// =====================================================================================================================

	utils.extend(Database.prototype, {
		getPadLines(padId, fields) {
			var cond = fields ? { attributes: (typeof fields == "string" ? fields.split(/\s+/) : fields) } : { };
			return this._getPadObjects("Line", padId, cond);
		},

		getPadLinesByType(padId, typeId) {
			return this._getPadObjects("Line", padId, { where: { typeId: typeId } });
		},

		getPadLinesWithPoints(padId, bboxWithZoom) {
			return utils.filterStreamPromise(this.getPadLines(padId), (data) => {
				return this.getLinePoints(data.id, bboxWithZoom).then((trackPoints) => {
					data.trackPoints = trackPoints;
					return data;
				});
			});
		},

		getLineTemplate(padId, data) {
			return utils.promiseAuto({
				lineTemplate: () => {
					var ret = JSON.parse(JSON.stringify(this._conn.model("Line").build(utils.extend({ }, data, { padId: padId }))));
					ret.data = data.data || { };
					return ret;
				},

				type: this.getType(padId, data.typeId),

				styles: (lineTemplate, type) => {
					if(type.defaultColour)
						lineTemplate.colour = type.defaultColour;
					if(type.defaultWidth)
						lineTemplate.width = type.defaultWidth;
					if(type.defaultMode)
						lineTemplate.mode = type.defaultMode;

					return this._updateObjectStyles(lineTemplate, true);
				}
			}).then((res) => {
				return res.lineTemplate;
			});
		},

		getLine(padId, lineId) {
			return this._getPadObject("Line", padId, lineId);
		},

		createLine(padId, data) {
			return utils.promiseAuto({
				defaultVals: this.getType(padId, data.typeId).then((type) => {
					if(type.defaultColour && !("colour" in data))
						data.colour = type.defaultColour;
					if(type.defaultWidth && !("width" in data))
						data.width = type.defaultWidth;
					if(type.defaultMode && !("mode" in data))
						data.mode = type.defaultMode;
				}),

				routing: (defaultVals) => {
					return this._calculateRouting(data);
				},

				createLine: (routing, defaultVals) => {
					var dataCopy = utils.extend({ }, data);
					delete dataCopy.trackPoints; // They came if mode is track

					return this._createPadObject("Line", padId, dataCopy);
				},

				lineEvent: (createLine) => {
					// We have to emit this before calling _setLinePoints so that this event is sent to the client first
					this.emit("line", padId, createLine);
				},

				setLinePoints: (routing, createLine, lineEvent) => {
					return this._setLinePoints(padId, createLine.id, routing);
				},

				updateStyle: (createLine) => {
					return this._updateObjectStyles(createLine, true);
				}
			}).then(res => res.createLine);
		},

		updateLine(padId, lineId, data, doNotUpdateStyles) {
			return utils.promiseAuto({
				originalLine: this.getLine(padId, lineId),

				routing: (originalLine) => {
					if(data.routePoints == null)
						data.routePoints = originalLine.routePoints;

					if(data.mode == null)
						data.mode = originalLine.mode || "";

					if((data.mode == "track" && data.trackPoints) || !underscore.isEqual(data.routePoints, originalLine.routePoints) || data.mode != originalLine.mode)
						return this._calculateRouting(data); // Also sets data.distance and data.time
				},

				newLine: (routing) => {
					var dataCopy = utils.extend({ }, data);
					delete dataCopy.trackPoints; // They came if mode is track

					return this._updatePadObject("Line", padId, lineId, dataCopy, doNotUpdateStyles);
				},

				updateStyle: (newLine) => {
					if(!doNotUpdateStyles)
						return this._updateObjectStyles(newLine, true); // Modifies newLine
				},

				linePoints: (newLine, routing) => {
					if(routing)
						return this._setLinePoints(newLine.padId, lineId, routing);
				}
			}).then((res) => {
				this.emit("line", padId, res.newLine);

				return res.newLine;
			});
		},

		_setLinePoints(padId, lineId, trackPoints, _noEvent) {
			// First get elevation, so that if that fails, we don't update anything
			let ascentDescent;
			return this._updateElevation(trackPoints).then((a) => {
				ascentDescent = a;

				return this._conn.model("LinePoint").destroy({ where: { lineId: lineId } });
			}).then(() => {
				var create = [ ];
				for(var i=0; i<trackPoints.length; i++) {
					create.push(Object.assign(JSON.parse(JSON.stringify(trackPoints[i])), { lineId: lineId }));
				}

				return this._bulkCreateInBatches(this._conn.model("LinePoint"), create);
			}).then((points) => {
				if(!_noEvent)
					this.emit("linePoints", padId, lineId, points);

				return this._updatePadObject("Line", padId, lineId, ascentDescent, true);
			}).then((newLine) => {
				if(!_noEvent)
					this.emit("line", padId, newLine);
			});
		},

		deleteLine(padId, lineId) {
			return utils.promiseAuto({
				line: this._deletePadObject("Line", padId, lineId),
				points: this._setLinePoints(padId, lineId, [ ], true)
			}).then((res) => {
				this.emit("deleteLine", padId, { id: lineId });

				return res.line;
			});
		},

		getLinePointsForPad(padId, bboxWithZoom) {
			return utils.filterStreamPromise(this.getPadLines(padId, "id"), (line) => {
				return this.getLinePoints(line.id, bboxWithZoom).then((trackPoints) => {
					if(trackPoints.length >= 2)
						return { id: line.id, trackPoints: trackPoints };
				});
			});
		},

		getLinePoints(lineId, bboxWithZoom) {
			return Promise.resolve().then(() => {
				return this._conn.model("Line").build({ id: lineId }).getLinePoints({
					where: Sequelize.and(this._makeBboxCondition(bboxWithZoom), bboxWithZoom ? { zoom: { lte: bboxWithZoom.zoom } } : null),
					attributes: [ "idx" ],
					order: "idx"
				});
			}).then((data) => {
				// Get one more point outside of the bbox for each segment
				var indexes = [ ];
				for(var i=0; i<data.length; i++) {
					if(i == 0 || data[i-1].idx != data[i].idx-1) // Beginning of segment
						indexes.push(data[i].idx-1);

					indexes.push(data[i].idx);

					if(i == data.length-1 || data[i+1].idx != data[i].idx+1) // End of segment
						indexes.push(data[i].idx+1);
				}

				if(indexes.length == 0)
					return [ ];

				return this.getLinePointsByIdx(lineId, indexes);
			});
		},

		getLinePointsByIdx(lineId, indexes) {
			return this._conn.model("Line").build({ id: lineId }).getLinePoints({
				where: { idx: indexes },
				attributes: [ "lon", "lat", "idx", "ele" ],
				order: "idx"
			});
		},

		_calculateRouting(line) {
			if(line.mode == "track" && line.trackPoints && line.trackPoints.length >= 2) {
				line.distance = utils.calculateDistance(line.trackPoints);
				line.time = null;

				routing._calculateZoomLevels(line.trackPoints);

				for(var i=0; i<line.trackPoints.length; i++)
					line.trackPoints[i].idx = i;

				return Promise.resolve(line.trackPoints);
			} else if(line.routePoints && line.routePoints.length >= 2 && line.mode && line.mode != "track") {
				return routing.calculateRouting(line.routePoints, line.mode).then((routeData) => {
					line.distance = routeData.distance;
					line.time = routeData.time;
					for(var i=0; i<routeData.trackPoints.length; i++)
						routeData.trackPoints[i].idx = i;
					return routeData.trackPoints;
				});
			} else {
				line.distance = utils.calculateDistance(line.routePoints);
				line.time = null;

				var trackPoints = [ ];
				for(var i=0; i<line.routePoints.length; i++) {
					trackPoints.push(utils.extend({ }, line.routePoints[i], { zoom: 1, idx: i }));
				}
				return Promise.resolve(trackPoints);
			}
		},

		_updateElevation(trackPoints) {
			let pointsToUpdate = trackPoints.filter((point) => (point.zoom < 12 && point.ele == null));

			return elevation.getElevationForPoints(pointsToUpdate).then((elevations) => {
				elevations.forEach((elevation, i) => {
					if(pointsToUpdate[i].setDataValue)
						pointsToUpdate[i].setDataValue("ele", elevation);
					else
						pointsToUpdate[i].ele = elevation;
				});

				return elevation.getAscentDescent(trackPoints.filter((point) => (point.ele != null)).map((point) => (point.ele)));
			});
		}
	});
};