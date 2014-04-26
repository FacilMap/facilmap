var backend = require("./databaseBackendMongodb");
var listeners = require("./listeners");
var routing = require("./routing");
var utils = require("./utils");

function getPadData(padId, callback) {
	backend.getPadData(padId, function(err, data) {
		if(err || data != null)
			return callback(err, data);

		backend.createPad(padId, callback);
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

		listeners.notifyPadListeners(data._pad, "view", data);
		callback(null, data);
	});
}

function updateView(viewId, data, callback) {
	if(data.name == null || data.name.trim().length == 0)
		return callback("No name provided.");

	backend.updateView(viewId, data, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(data._pad, "view", data);
		callback(null, data);
	});
}

function deleteView(viewId, callback) {
	backend.deleteView(viewId, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(data._pad, "deleteView", { id: data.id });
		callback(null, data);
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
		callback(null, data);
	});
}

function updateMarker(markerId, data, callback) {
	backend.updateMarker(markerId, data, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(data._pad, "marker", _getMarkerDataFunc(data));
		callback(null, data);
	});
}

function deleteMarker(markerId, callback) {
	backend.deleteMarker(markerId, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(data._pad, "deleteMarker", { id: data.id });
		callback(null, data);
	});
}

function getPadLines(padId, bbox) {
	return utils.filterStreamAsync(backend.getPadLines(padId, bbox), function(data, next) {
		_getLinePoints(data.id, bbox, function(err, points) {
			if(err)
				return next(err);

			data.actualPoints = points;
			next(null, data);
		});
	});
}

function createLine(padId, data, callback) {
	backend.createLine(padId, data, function(err, data) {
		if(err)
			return callback(err);

		_calculateRouting(data, function(err, data, actualPoints) {
			if(err)
				return callback(err);

			backend.setLinePoints(data.id, actualPoints, function(err) {
				if(err)
					return callback;

				listeners.notifyPadListeners(data._pad, "line", _getLineDataFunc(data, actualPoints));
				callback(null, data);
			});
		});
	});
}

function updateLine(lineId, data, callback) {
	backend.updateLine(lineId, data, function(err, data) {
		if(err)
			return callback(err);

		_calculateRouting(data, function(err, data, actualPoints) {
			backend.setLinePoints(lineId, actualPoints, function(err) {
				if(err)
					return callback;

				listeners.notifyPadListeners(data._pad, "line", _getLineDataFunc(data, actualPoints));
				callback(null, data);
			});
		});
	});
}

function deleteLine(lineId, callback) {
	backend.deleteLine(lineId, function(err, data) {
		if(err)
			return callback(err);

		backend.setLinePoints(lineId, [ ], function(err) {
			if(err)
				return callback;

			listeners.notifyPadListeners(data._pad, "deleteLine", { id: data.id });
			callback(null, data);
		});
	});
}

function _calculateRouting(line, callback) {
	if(line.points && line.points.length >= 2 && line.mode) {
		routing.calculateRouting(line.points, line.mode, function(err, routeData) {
			if(err)
				return callback(err);

			line.distance = routeData.distance;
			line.time = routeData.time;
			callback(null, line, routeData.actualPoints);
		});
	} else {
		line.distance = utils.calculateDistance(line.points);
		line.time = null;

		var actualPoints = [ ];
		for(var i=0; i<line.points.length; i++) {
			actualPoints.push(utils.extend({ }, line.points[i], { zoom: 1 }));
		}
		callback(null, line, actualPoints);
	}
}

function _getMarkerDataFunc(marker) {
	return function(bbox) {
		if(!utils.isInBbox(marker.position, bbox))
			return null;

		return marker;
	};
}

function _getLineDataFunc(line, actualPoints) {
	return function(bbox) {
		var points = routing.prepareForBoundingBox(actualPoints, bbox);
		if(points.length <= 1)
			return null;

		return utils.extend({ }, line, { actualPoints: points });
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
	getPadMarkers : getPadMarkers,
	createMarker : createMarker,
	updateMarker : updateMarker,
	deleteMarker : deleteMarker,
	getPadLines : getPadLines,
	createLine : createLine,
	updateLine : updateLine,
	deleteLine : deleteLine
};