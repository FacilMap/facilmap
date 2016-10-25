var backend = require("./databaseBackendSequelize");
var listeners = require("./listeners");
var routing = require("./routing");
var utils = require("./utils");
var underscore = require("underscore");
var stream = require("stream");
var Promise = require("promise");

var DEFAULT_TYPES = [
	{ name: "Marker", type: "marker", fields: [ { name: "Description", type: "textarea" } ] },
	{ name: "Line", type: "line", fields: [ { name: "Description", type: "textarea" } ] }
];

function padIdExists(padId) {
	return backend.padIdExists(padId);
}

function getPadData(padId) {
	return backend.getPadDataByWriteId(padId).then(function(data) {
		if(data != null)
			return utils.extend(JSON.parse(JSON.stringify(data)), { writable: true });

		return backend.getPadData(padId).then(function(data) {
			if(data != null)
				return utils.extend(JSON.parse(JSON.stringify(data)), { writable: false, writeId: null });

			throw "This pad does not exist.";
		});
	});
}

function createPad(data) {
	return Promise.resolve().then(function() {
		if(!data.id || data.id.length == 0)
			throw "Invalid read-only ID";
		if(!data.writeId || data.writeId.length == 0)
			throw "Invalid write-only ID";
		if(data.id == data.writeId)
			throw "Read-only and write-only ID cannot be the same.";

		return Promise.all([
			padIdExists(data.id).then(function(exists) {
				if(exists)
					throw "ID '" + data.id + "' is already taken.";
			}),
			padIdExists(data.writeId).then(function(exists) {
				if(exists)
					throw "ID '" + data.writeId + "' is already taken.";
			})
		])
	}).then(function() {
		return backend.createPad(data);
	}).then(function(newData) {
		data = newData;

		return Promise.all(DEFAULT_TYPES.map(function(it) {
			return backend.createType(data.id, it);
		}));
	}).then(function() {
		return utils.extend(JSON.parse(JSON.stringify(data)), { writable: true });
	});
}

function updatePadData(padId, data) {
	return Promise.resolve().then(function() {
		if(data.id != null && data.id != padId && data.id.length == 0)
			throw "Invalid read-only ID";

		var existsPromises = [ ];

		if(data.id != null && data.id != padId) {
			existsPromises.push(padIdExists(data.id).then(function(exists) {
				if(exists)
					throw "ID '" + data.id + "' is already taken.";
			}));
		}

		if(data.writeId != null) {
			existsPromises.push(backend.getPadData(padId).then(function(padData) {
				if(data.writeId != padData.writeId) {
					if(data.writeId.length == 0)
						throw "Invalid write-only ID";
					if(data.writeId == (data.id != null ? data.id : padId))
						throw "Read-only and write-only ID cannot be the same.";

					return padIdExists(data.writeId).then(function(exists) {
						if(exists)
							throw "ID '" + data.writeId + "' is already taken.";
					});
				}
			}));
		}

		return Promise.all(existsPromises);
	}).then(function() {
		return backend.updatePadData(padId, data);
	}).then(function(newData) {
		listeners.notifyPadListeners(padId, "padData", function(listener) {
			var dataClone = JSON.parse(JSON.stringify(newData));
			if(!listener.writable)
				dataClone.writeId = null;

			return dataClone;
		});

		if(data.id != null && data.id != padId)
			listeners.changePadId(padId, data.id);

		return data;
	});
}

function getViews(padId) {
	return backend.getViews(padId);
}

function createView(padId, data) {
	return Promise.resolve().then(function() {
		if(data.name == null || data.name.trim().length == 0)
			throw "No name provided.";

		return backend.createView(padId, data);
	}).then(function(data) {
		listeners.notifyPadListeners(data.padId, "view", data);

		return data;
	});
}

function updateView(viewId, data) {
	return Promise.resolve().then(function() {
		if(data.name == null || data.name.trim().length == 0)
			throw "No name provided.";

		return backend.updateView(viewId, data);
	}).then(function(data) {
		listeners.notifyPadListeners(data.padId, "view", data);

		return data;
	});
}

function deleteView(viewId) {
	return backend.deleteView(viewId).then(function(data) {
		listeners.notifyPadListeners(data.padId, "deleteView", { id: data.id });

		return data;
	});
}

function getTypes(padId) {
	return backend.getTypes(padId);
}

function createType(padId, data) {
	return Promise.resolve().then(function() {
		if(data.name == null || data.name.trim().length == 0)
			throw "No name provided.";

		return backend.createType(padId, data);
	}).then(function(data) {
		listeners.notifyPadListeners(data.padId, "type", data);

		return data;
	});
}

function updateType(typeId, data) {
	return Promise.resolve().then(function() {
		if(data.name == null || data.name.trim().length == 0)
			throw "No name provided.";

		return backend.updateType(typeId, data);
	}).then(function(data) {
		listeners.notifyPadListeners(data.padId, "type", data);

		return _updateObjectStyles(data.type == "line" ? backend.getPadLinesByType(data.padId, typeId) : backend.getPadMarkersByType(data.padId, typeId), data.type == "line").then(function() {
			return data;
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

function deleteType(typeId) {
	return backend.isTypeUsed(typeId).then(function(isUsed) {
		if(isUsed)
			throw "This type is in use.";

		return backend.deleteType(typeId);
	}).then(function(data) {
		listeners.notifyPadListeners(data.padId, "deleteType", { id: data.id });

		return data;
	});
}

function getPadMarkers(padId, bbox) {
	return backend.getPadMarkers(padId, bbox);
}

function createMarker(padId, data) {
	return Promise.resolve().then(function() {
		return backend.getType(data.typeId);
	}).then(function(type) {
		if(type.defaultColour)
			data.colour = type.defaultColour;
		if(type.defaultSize)
			data.size = type.defaultSize;
		if(type.defaultSymbol)
			data.symbol = type.defaultSymbol;

		return backend.createMarker(padId, data)
	}).then(function(data) {
		listeners.notifyPadListeners(padId, "marker", _getMarkerDataFunc(data));

		return _updateObjectStyles(data, false).then(function() {
			return data;
		});
	});
}

function updateMarker(markerId, data) {
	return _updateMarker(markerId, data).then(function(data) {
		return _updateObjectStyles(data, false).then(function() {
			return data;
		});
	});
}

function _updateMarker(markerId, data) {
	return backend.updateMarker(markerId, data).then(function(data) {
		listeners.notifyPadListeners(data.padId, "marker", _getMarkerDataFunc(data));

		return data;
	});
}

function deleteMarker(markerId) {
	return backend.deleteMarker(markerId).then(function(data) {
		listeners.notifyPadListeners(data.padId, "deleteMarker", { id: data.id });

		return data;
	});
}

function _updateObjectStyles(objectStream, isLine) {
	if(!(objectStream instanceof stream.Readable))
		objectStream = new utils.ArrayStream([ objectStream ]);

	var types = { };
	return utils.streamEachPromise(objectStream, function(object) {
		return Promise.resolve().then(function() {
			if(!types[object.typeId]) {
				return backend.getType(object.typeId).then(function(type) {
					if(type == null)
						throw "Type "+object.typeId+" does not exist.";

					return types[object.typeId] = type;
				});
			} else
				return types[object.typeId];
		}).then(function(type) {
			var update = { };

			if(type.colourFixed && object.colour != type.defaultColour)
				update.colour = type.defaultColour;
			if(!isLine && type.sizeFixed && object.size != type.defaultSize)
				update.size = type.defaultSize;
			if(!isLine && type.symbolFixed && object.symbol != type.defaultSymbol)
				update.symbol = type.defaultSymbol;
			if(isLine && type.widthFixed && object.width != type.defaultWidth)
				update.width = type.defaultWidth;
			if(isLine && type.modeFixed && object.mode != "track" && object.mode != type.defaultMode)
				update.mode = type.defaultMode;

			types[object.typeId].fields.forEach(function(field) {
				if(field.type == "dropdown" && (field.controlColour || (!isLine && field.controlSize) || (!isLine && field.controlSymbol) || (isLine && field.controlWidth))) {
					var _find = function(value) {
						for(var j=0; j<(field.options || []).length; j++) {
							if(field.options[j].key == value)
								return field.options[j];
						}
						return null;
					};

					var option = _find(object.data[field.name]) || _find(field.default) || field.options[0];

					if(option != null) {
						if(field.controlColour && object.colour != option.colour)
							update.colour = option.colour;
						if(!isLine && field.controlSize && object.size != option.size)
							update.size = option.size;
						if(!isLine && field.controlSymbol && object.symbol != option.symbol)
							update.symbol = option.symbol;
						if(isLine && field.controlWidth && object.width != option.width)
							update.width = option.width;
					}
				}
			});

			var ret = [ ];

			if(Object.keys(update).length > 0) {
				utils.extend(object, update);

				if(object.id) // Objects from getLineTemplate() do not have an ID
					ret.push((isLine ? _updateLine : _updateMarker)(object.id, update));

				if(object.id && isLine && "mode" in update) {
					ret.push(_calculateRouting(object).then(function(trackPoints) {
						return _setLinePoints(object.padId, object.id, trackPoints);
					}));
				}
			}

			return Promise.all(ret);
		});
	});
}

function getPadLines(padId) {
	return backend.getPadLines(padId);
}

function getPadLinesWithPoints(padId, bboxWithZoom) {
	return utils.filterStreamPromise(backend.getPadLines(padId), function(data) {
		return _getLinePoints(data.id, bboxWithZoom).then(function(trackPoints) {
			data.trackPoints = trackPoints;
			return data;
		});
	});
}

function getLineTemplate(data) {
	return utils.promiseAllObject({
		lineTemplate: backend.getLineTemplate(data),
		type: backend.getType(data.typeId)
	}).then(function(res) {
		var line = res.lineTemplate;

		if(res.type.defaultColour)
			line.colour = res.type.defaultColour;
		if(res.type.defaultWidth)
			line.width = res.type.defaultWidth;
		if(res.type.defaultMode)
			res.mode = res.type.defaultMode;

		return _updateObjectStyles(line, true).then(function() {
			return line;
		});
	});
}

function createLine(padId, data) {
	var defaultValsP = backend.getType(data.typeId).then(function(type) {
		if(type.defaultColour && !("colour" in data))
			data.colour = type.defaultColour;
		if(type.defaultWidth && !("width" in data))
			data.width = type.defaultWidth;
		if(type.defaultMode && !("mode" in data))
			data.mode = type.defaultMode;
	});

	var calculateRoutingP = defaultValsP.then(function() {
		return _calculateRouting(data);
	});

	var createLineP = calculateRoutingP.then(function() {
		return _createLine(padId, data);
	});

	var setLinePointsP = Promise.all([ calculateRoutingP, createLineP ]).then(function(res) {
		return _setLinePoints(padId, res[1].id, res[0]);
	});

	var updateLineStyleP = createLineP.then(function(lineData) {
		return _updateObjectStyles(lineData, true);
	});

	return Promise.all([ defaultValsP, calculateRoutingP, createLineP, setLinePointsP, updateLineStyleP ]).then(function(res) {
		return res[2];
	});
}

function updateLine(lineId, data) {
	var originalLineP = backend.getLine(lineId);

	var calculateRoutingP = originalLineP.then(function(originalLine) {
		if(data.routePoints == null)
			data.routePoints = originalLine.routePoints;

		if(data.mode == null)
			data.mode = originalLine.mode || "";

		if((data.mode == "track" && data.trackPoints) || !underscore.isEqual(data.routePoints, originalLine.routePoints) || data.mode != originalLine.mode)
			return _calculateRouting(data); // Also sets data.distance and data.time
	});

	var updateLineP = calculateRoutingP.then(function() {
		return _updateLine(lineId, data);
	});

	var updateLineStyleP = updateLineP.then(function(newLine) {
		return _updateObjectStyles(newLine, true); // Modifies res.updateLine
	});

	var setLinePointsP = Promise.all([ originalLineP, calculateRoutingP ]).then(function(res) {
		if(res[1])
			return _setLinePoints(res[0].padId, lineId, res[1]);
	});

	return Promise.all([ originalLineP, calculateRoutingP, updateLineP, updateLineStyleP, setLinePointsP ]).then(function(res) {
		return res[2];
	});
}

function _createLine(padId, data) {
	var dataCopy = utils.extend({ }, data);
	delete dataCopy.trackPoints; // They came if mode is track

	return backend.createLine(padId, dataCopy).then(function(newData) {
		listeners.notifyPadListeners(newData.padId, "line", newData);

		return newData;
	});
}

function _updateLine(lineId, data) {
	var dataCopy = utils.extend({ }, data);
	delete dataCopy.trackPoints; // They came if mode is track

	return backend.updateLine(lineId, dataCopy).then(function(newData) {
		listeners.notifyPadListeners(newData.padId, "line", newData);

		return newData;
	});
}

function _setLinePoints(padId, lineId, trackPoints) {
	return backend.setLinePoints(lineId, trackPoints).then(function() {
		listeners.notifyPadListeners(padId, "linePoints", function(listener) {
			return { reset: true, id: lineId, trackPoints : (listener && listener.bbox ? routing.prepareForBoundingBox(trackPoints, listener.bbox) : [ ]) };
		});
	});
}

function deleteLine(lineId) {
	return backend.deleteLine(lineId).then(function(data) {
		return backend.setLinePoints(lineId, [ ]).then(function() {
			return data;
		});
	}).then(function(data) {
		listeners.notifyPadListeners(data.padId, "deleteLine", { id: data.id });

		return data;
	});
}

function getLinePoints(padId, bboxWithZoom) {
	return utils.filterStreamPromise(backend.getPadLines(padId, "id"), function(data) {
		return _getLinePoints(data.id, bboxWithZoom).then(function(trackPoints) {
			if(trackPoints.length >= 2)
				return { id: data.id, trackPoints: trackPoints };
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

function _calculateRouting(line) {
	if(line.mode == "track" && line.trackPoints && line.trackPoints.length >= 2) {
		line.distance = utils.calculateDistance(line.trackPoints);
		line.time = null;

		routing._calculateZoomLevels(line.trackPoints);

		for(var i=0; i<line.trackPoints.length; i++)
			line.trackPoints[i].idx = i;

		return Promise.resolve(line.trackPoints);
	} else if(line.routePoints && line.routePoints.length >= 2 && line.mode && line.mode != "track") {
		return routing.calculateRouting(line.routePoints, line.mode).then(function(routeData) {
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
}

function _getMarkerDataFunc(marker) {
	return function(listener) {
		if(!listener || !listener.bbox || !utils.isInBbox(marker, listener.bbox))
			return null;

		return marker;
	};
}

function _getLinePoints(lineId, bboxWithZoom) {
	return backend.getLinePointsByBbox(lineId, bboxWithZoom).then(function(data) {
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

		return backend.getLinePointsByIdx(lineId, indexes);
	});
}

module.exports = {
	connect : backend.connect,
	getPadData : getPadData,
	padIdExists : padIdExists,
	createPad : createPad,
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