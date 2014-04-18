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
	return backend.getPadLines(padId, bbox);
}

function createLine(padId, data, callback) {
	_calculateRouting(data, function(err, data) {
		if(err)
			return callback(err);

		backend.createLine(padId, data, function(err, data) {
			if(err)
				return callback(err);

			listeners.notifyPadListeners(data._pad, "line", _getLineDataFunc(data));
			callback(null, data);
		});
	});
}

function updateLine(lineId, data, callback) {
	_calculateRouting(data, function(err, data) {
		backend.updateLine(lineId, data, function(err, data) {
			if(err)
				return callback(err);

			listeners.notifyPadListeners(data._pad, "line", _getLineDataFunc(data));
			callback(null, data);
		});
	});
}

function deleteLine(lineId, callback) {
	backend.deleteLine(lineId, function(err, data) {
		if(err)
			return callback(err);

		listeners.notifyPadListeners(data._pad, "deleteLine", { id: data.id });
		callback(null, data);
	});
}

function _calculateRouting(line, callback) {
	if(line.points && line.points.length >= 2 && line.mode) {
		routing.calculateRouting(line.points, line.mode, function(err, routeData) {
			if(err)
				return callback(err);

			utils.extend(line, routeData);
			callback(null, line);
		});
	} else {
		line.actualPoints = line.points;
		line.distance = utils.calculateDistance(line.points);
		line.time = null;
		callback(null, line);
	}
}

function _getMarkerDataFunc(marker) {
	return function(bbox) {
		if(!utils.isInBbox(marker.position, bbox))
			return null;

		return marker;
	};
}

function _getLineDataFunc(line) {
	return function(bbox) {
		var strippedLine = routing.prepareLineForBoundingBox(line, bbox);
		if(strippedLine.actualPoints.length <= 1)
			return null;

		return strippedLine;
	};
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