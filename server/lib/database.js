var backend = require("./databaseBackendSequelize");
var listeners = require("./listeners");
var routing = require("./routing");
var utils = require("./utils");
var async = require("async");
var underscore = require("underscore");
var stream = require("stream");

var DEFAULT_TYPES = [
	{ name: "marker", type: "marker", fields: [ { name: "Description", type: "textarea" } ] },
	{ name: "line", type: "line", fields: [ { name: "Description", type: "textarea" } ] }
];

function getPadData(padId, callback) {
	backend.getPadDataByWriteId(padId, function(err, data) {
		if(err)
			return callback(err);
		else if(data != null)
			return callback(null, utils.extend(JSON.parse(JSON.stringify(data)), { writable: true, writeId: null }));

		backend.getPadData(padId, function(err, data) {
			if(err || data != null)
				return callback(err, utils.extend(JSON.parse(JSON.stringify(data)), { writable: false, writeId: null }));

			backend.createPad(utils.generateRandomId(10), padId, function(err, data) {
				if(err)
					return callback(err);

				async.each(DEFAULT_TYPES, function(it, next) {
					backend.createType(data.id, it, next);
				}, function(err) {
					callback(err, utils.extend(JSON.parse(JSON.stringify(data)), { writable: true, writeId: null }));
				});
			});
		});
	});
}

function updatePadData(padId, data, callback) {
	backend.updatePadData(padId, data, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(padId, "padData", data);
		callback(null, data);
	});
}

function getViews(padId) {
	return backend.getViews(padId);
}

function createView(padId, data, callback) {
	if(data.name == null || data.name.trim().length == 0)
		return callback("No name provided.");

	backend.createView(padId, data, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(data.padId, "view", data);
		callback(null, data);
	});
}

function updateView(viewId, data, callback) {
	if(data.name == null || data.name.trim().length == 0)
		return callback("No name provided.");

	backend.updateView(viewId, data, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(data.padId, "view", data);
		callback(null, data);
	});
}

function deleteView(viewId, callback) {
	backend.deleteView(viewId, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(data.padId, "deleteView", { id: data.id });
		callback(null, data);
	});
}

function getTypes(padId) {
	return backend.getTypes(padId);
}

function createType(padId, data, callback) {
	if(data.name == null || data.name.trim().length == 0)
		return callback("No name provided.");

	backend.createType(padId, data, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(data.padId, "type", data);
		callback(null, data);
	});
}

function updateType(typeId, data, callback) {
	if(data.name == null || data.name.trim().length == 0)
		return callback("No name provided.");

	backend.updateType(typeId, data, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(data.padId, "type", data);

		_updateObjectStyles(data.type == "line" ? backend.getPadLinesByType(data.padId, typeId) : backend.getPadMarkersByType(data.padId, typeId), data.type == "line", function(err) {
			callback(err, data);
		});
	});
}

function _optionsToObj(options, idx) {
	var ret = { };
	if(options) {
		for(var i=0; i<options.length; i++) {
			ret[options[i].key] = options[i][idx];
		}
	}
	return ret;
}

function deleteType(typeId, callback) {
	backend.isTypeUsed(typeId, function(err, isUsed) {
		if(err)
			return callback(err);
		if(isUsed)
			return callback("This type is in use.");

		backend.deleteType(typeId, function(err, data) {
			if(err)
				return callback(err);

			listeners.notifyPadListeners(data.padId, "deleteType", { id: data.id });
			callback(null, data);
		});
	});
}

function getPadMarkers(padId, bbox) {
	return backend.getPadMarkers(padId, bbox);
}

function createMarker(padId, data, callback) {
	backend.createMarker(padId, data, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(padId, "marker", _getMarkerDataFunc(data));

		_updateObjectStyles(data, false, function(err) {
			callback(err, data);
		});
	});
}

function updateMarker(markerId, data, callback) {
	_updateMarker(markerId, data, function(err, data) {
		if(err)
			return callback(err);

		_updateObjectStyles(data, false, function(err) {
			callback(err, data);
		});
	});
}

function _updateMarker(markerId, data, callback) {
	backend.updateMarker(markerId, data, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(data.padId, "marker", _getMarkerDataFunc(data));
		callback(null, data);
	});
}

function deleteMarker(markerId, callback) {
	backend.deleteMarker(markerId, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(data.padId, "deleteMarker", { id: data.id });
		callback(null, data);
	});
}

function _updateObjectStyles(objectStream, isLine, callback) {
	if(!(objectStream instanceof stream.Readable))
		objectStream = new utils.ArrayStream([ objectStream ]);

	var types = { };
	utils.asyncStreamEach(objectStream, function(object, next) {
		async.series([
			function(next) {
				if(types[object.typeId])
					return next();

				backend.getType(object.typeId, function(err, type) {
					if(type == null)
						return next("Type "+object.typeId+" does not exist.");
					types[object.typeId] = type;
					next(null);
				});
			},
			function(next) {
				async.each(types[object.typeId].fields, function(field, next) {
					if(field.type == "dropdown" && (field.controlColour || (isLine && field.controlWidth))) {
						var _find = function(value) {
							for(var j=0; j<(field.options || []).length; j++) {
								if(field.options[j].key == value)
									return field.options[j];
							}
							return null;
						};

						var option = _find(object.data[field.name]) || _find(field.default) || field.options[0];

						var update = { };
						if(option != null) {
							if(field.controlColour && object.colour != option.colour)
								update.colour = option.colour;
							if(isLine && field.controlWidth && object.width != option.width)
								update.width = option.width;
						}

						utils.extend(object, update);

						if(Object.keys(update).length > 0 && object.id) // Objects from getLineTemplate() do not have an ID
							return (isLine ? _updateLine : _updateMarker)(object.id, update, next);
						else
							return next();
					}
					next();
				}, next);
			}
		], next);
	}, callback);
}

function getPadLines(padId) {
	return backend.getPadLines(padId);
}

function getPadLinesWithPoints(padId, bboxWithZoom) {
	return utils.filterStreamAsync(backend.getPadLines(padId), function(data, next) {
		_getLinePoints(data.id, bboxWithZoom, function(err, trackPoints) {
			if(err)
				return next(err);

			data.trackPoints = trackPoints;
			next(null, data);
		});
	});
}

function getLineTemplate(data, callback) {
	backend.getLineTemplate(data, function(err, line) {
		if(err)
			return callback(err);

		_updateObjectStyles(line, true, function(err) {
			return callback(err, line);
		});
	});
}

function createLine(padId, data, callback) {
	async.auto({
		calculateRouting : function(next) {
			_calculateRouting(data, next); // Also sets data.distance and data.time
		},
		createLine : [ "calculateRouting", function(res, next) {
			_createLine(padId, data, next);
		} ],
		setLinePoints : [ "createLine", "calculateRouting", function(res, next) {
			_setLinePoints(padId, res.createLine.id, res.calculateRouting, next);
		} ],
		updateLineStyle : [ "createLine", function(res, next) {
			_updateObjectStyles(res.createLine, true, next); // Modifies res.createLine
		} ]
	}, function(err, res) {
		return callback(err, res.createLine);
	});
}

function updateLine(lineId, data, callback) {
	async.auto({
		originalLine : backend.getLine.bind(backend, lineId),
		calculateRouting : [ "originalLine", function(res, next) {
			if(data.routePoints == null)
				data.routePoints = res.originalLine.routePoints;

			if(data.mode == null)
				data.mode = res.originalLine.mode || "";

			if(underscore.isEqual(data.routePoints, res.originalLine.routePoints) && data.mode == res.originalLine.mode)
				return next();

			_calculateRouting(data, next); // Also sets data.distance and data.time
		} ],
		updateLine : [ "calculateRouting", function(res, next) {
			_updateLine(lineId, data, next);
		} ],
		updateLineStyle : [ "updateLine", function(res, next) {
			_updateObjectStyles(res.updateLine, true, next); // Modifies res.updateLine
		} ],
		setLinePoints : [ "originalLine", "calculateRouting", function(res, next) {
			if(!res.calculateRouting)
				return next();

			_setLinePoints(res.originalLine.padId, lineId, res.calculateRouting, next);
		} ]
	}, function(err, res) {
		callback(err, res.updateLine);
	});
}

function _createLine(padId, data, callback) {
	backend.createLine(padId, data, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(data.padId, "line", data);
		callback(null, data);
	});
}

function _updateLine(lineId, data, callback) {
	backend.updateLine(lineId, data, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(data.padId, "line", data);
		callback(null, data);
	});
}

function _setLinePoints(padId, lineId, trackPoints, callback) {
	backend.setLinePoints(lineId, trackPoints, function(err) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(padId, "linePoints", function(bboxWithZoom) {
			return { reset: true, id: lineId, trackPoints : (bboxWithZoom ? routing.prepareForBoundingBox(trackPoints, bboxWithZoom) : [ ]) };
		});

		callback(null);
	});
}

function deleteLine(lineId, callback) {
	backend.deleteLine(lineId, function(err, data) {
		if(err)
			return callback(err);

		backend.setLinePoints(lineId, [ ], function(err) {
			if(err)
				return callback;

			listeners.notifyPadListeners(data.padId, "deleteLine", { id: data.id });
			callback(null, data);
		});
	});
}

function getLinePoints(padId, bboxWithZoom) {
	return utils.filterStreamAsync(backend.getPadLines(padId, "id"), function(data, next) {
		_getLinePoints(data.id, bboxWithZoom, function(err, trackPoints) {
			if(err)
				return next(err);

			if(trackPoints.length >= 2)
				next(null, { id: data.id, trackPoints: trackPoints });
			else
				next(null, null);
		});
	});
}

/*function copyPad(fromPadId, toPadId, callback) {
	function _handleStream(stream, next, cb) {
		stream.on("data", function(data) {
			stream.pause();
			cb(data, function() {
				stream.resume();
			});
		});

		stream.on("error", next);
		stream.on("end", next);
	}

	async.auto({
		fromPadData : function(next) {
			backend.getPadData(fromPadId, next);
		},
		toPadData : function(next) {
			getPadData(toPadId, next);
		},
		padsExist : [ "fromPadData", "toPadData", function(r, next) {
			if(!r.fromPadData)
				return next(new Error("Pad "+fromPadId+" does not exist."));
			if(!r.toPadData.writable)
				return next(new Error("Destination pad is read-only."));

			toPadId = r.toPadData.id;

			next();
		}],
		copyMarkers : [ "padsExist", function(r, next) {
			_handleStream(getPadMarkers(fromPadId, null), next, function(marker, cb) {
				createMarker(toPadId, marker, cb);
			});
		}],
		copyLines : [ "padsExist", function(r, next) {
			_handleStream(getPadLines(fromPadId), next, function(line, cb) {
				async.auto({
					createLine : function(next) {
						_createLine(toPadId, line, next);
					},
					getLinePoints : function(next) {
						backend.getLinePoints(line.id, next);
					},
					setLinePoints : [ "createLine", "getLinePoints", function(r, next) {
						_setLinePoints(toPadId, r.createLine.id, r.getLinePoints, next);
					} ]
				}, cb);
			});
		}],
		copyViews : [ "padsExist", function(r, next) {
			_handleStream(getViews(fromPadId), next, function(view, cb) {
				createView(toPadId, view, function(err, newView) {
					if(err)
						return cb(err);

					if(r.fromPadData.defaultView && r.fromPadData.defaultView.id == view.id && r.toPadData.defaultView == null)
						updatePadData(toPadId, { defaultView: newView.id }, cb);
					else
						cb();
				});
			});
		}]
	}, callback);
}*/

function _calculateRouting(line, callback) {
	if(line.routePoints && line.routePoints.length >= 2 && line.mode) {
		routing.calculateRouting(line.routePoints, line.mode, function(err, routeData) {
			if(err)
				return callback(err);

			line.distance = routeData.distance;
			line.time = routeData.time;
			for(var i=0; i<routeData.trackPoints.length; i++)
				routeData.trackPoints[i].idx = i;
			callback(null, routeData.trackPoints);
		});
	} else {
		line.distance = utils.calculateDistance(line.routePoints);
		line.time = null;

		var trackPoints = [ ];
		for(var i=0; i<line.routePoints.length; i++) {
			trackPoints.push(utils.extend({ }, line.routePoints[i], { zoom: 1, idx: i }));
		}
		callback(null, trackPoints);
	}
}

function _getMarkerDataFunc(marker) {
	return function(bbox) {
		if(!bbox || !utils.isInBbox(marker, bbox))
			return null;

		return marker;
	};
}

function _getLinePoints(lineId, bboxWithZoom, callback) {
	backend.getLinePointsByBbox(lineId, bboxWithZoom, function(err, data) {
		if(err)
			return callback(err);

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
			return callback(null, [ ]);

		backend.getLinePointsByIdx(lineId, indexes, callback);
	});
}

module.exports = {
	connect : backend.connect,
	getPadData : getPadData,
	updatePadData : updatePadData,
	getViews : getViews,
	createView : createView,
	updateView : updateView,
	deleteView : deleteView,
	getTypes : getTypes,
	createType : createType,
	updateType : updateType,
	deleteType : deleteType,
	getPadMarkers : getPadMarkers,
	createMarker : createMarker,
	updateMarker : updateMarker,
	deleteMarker : deleteMarker,
	getPadLines : getPadLines,
	getPadLinesWithPoints : getPadLinesWithPoints,
	getLineTemplate : getLineTemplate,
	createLine : createLine,
	updateLine : updateLine,
	deleteLine : deleteLine,
	getLinePoints : getLinePoints,
	//copyPad : copyPad,
	_defaultTypes : DEFAULT_TYPES
};