var mongoose = require("mongoose");
var config = require("../config");
var utils = require("./utils");

mongoose.connect(config.db);

var ObjectId = mongoose.Schema.Types.ObjectId;

var positionType = {
	lon: Number,
	lat: Number
};

var bboxType = {
	top: Number,
	right: Number,
	bottom: Number,
	left: Number
};

var markerSchema = mongoose.Schema({
	_pad : { type: String, ref: "Pad" },
	position : positionType,
	name : { type: String, default: "Untitled marker" },
	description : String,
	style : { type: String, default: "red" }
});

var lineSchema = mongoose.Schema({
	_pad : { type: String, ref: "Pad" },
	points : [positionType],
	actualPoints : [positionType],
	mode : String,
	colour : { type: String, default: "0000ff" },
	width : { type: Number, default: 3 },
	description : String,
	name : { type: String, default: "Untitled line" }
});

var viewSchema = mongoose.Schema({
	_pad : { type: String, ref: "Pad" },
	name : String,
	baseLayer : String,
	layers : [String],
	view : bboxType
});

var padSchema = mongoose.Schema({
	_id : String,
	defaultView : { type: ObjectId, ref: "View" },
	name: { type: String, default: "New FacilPad" }
});

var Marker = mongoose.model("Marker", markerSchema);
var Line = mongoose.model("Line", lineSchema);
var View = mongoose.model("View", viewSchema);
var Pad = mongoose.model("Pad", padSchema);

function getPadData(padId, callback) {
	Pad.findById(padId).populate("defaultView").exec(_fixIdCallback(callback));
}

function createPad(padId, callback) {
	Pad.create({ _id: padId }, _fixIdCallback(callback));
}

function updatePadData(padId, data, callback) {
	Pad.findByIdAndUpdate(padId, data).populate("defaultView").exec(_fixIdCallback(callback));
}

function getViews(padId) {
	return _fixIdStream(View.find({ "_pad" : padId }).stream());
}

function createView(padId, data, callback) {
	data._pad = padId;
	View.create(data, _fixIdCallback(callback));
}

function updateView(viewId, data, callback) {
	View.findByIdAndUpdate(viewId, data, _fixIdCallback(callback));
}

function deleteView(viewId, callback) {
	View.findByIdAndRemove(viewId, _fixIdCallback(callback));
}

function getPadMarkers(padId, bbox) {
	var condition = {
		"_pad" : padId,
		"position.lat" : { $lte: bbox.top, $gte: bbox.bottom }
	};

	if(bbox.right < bbox.left) // Bbox spans over lon=180
		condition["position.lon"] = { $or: [ { $gte: bbox.left }, { $lte: bbox.right } ] };
	else
		condition["position.lon"] = { $gte: bbox.left, $lte: bbox.right };

	return _fixIdStream(Marker.find(condition).stream());
}

function createMarker(padId, data, callback) {
	data._pad = padId;
	Marker.create(data, _fixIdCallback(callback));
}

function updateMarker(markerId, data, callback) {
	Marker.findByIdAndUpdate(markerId, data, _fixIdCallback(callback));
}

function deleteMarker(markerId, callback) {
	Marker.findByIdAndRemove(markerId, _fixIdCallback(callback));
}

function getPadLines(padId, bbox) {
	var condition = { // TODO
		"_pad" : padId
	};

	return _fixIdStream(Line.find(condition).stream());
}

function createLine(padId, data, callback) {
	data._pad = padId;
	Line.create(data, _fixIdCallback(callback));
}

function updateLine(lineId, data, callback) {
	Line.findByIdAndUpdate(lineId, data, _fixIdCallback(callback));
}

function deleteLine(lineId, callback) {
	Line.findByIdAndRemove(lineId, _fixIdCallback(callback));
}

function _fixId(data) {
	if(data != null) {
		data = JSON.parse(JSON.stringify(data));
		data.id = data._id;
		delete data._id;

		if(data.defaultView) {
			data.defaultView.id = data.defaultView._id;
			delete data.defaultView._id;
		}
	}
	return data;
}

function _fixIdCallback(callback) {
	return function(err, data) {
		callback(err, _fixId(data));
	}
}

function _fixIdStream(stream) {
	return utils.filterStream(stream, _fixId);
}

module.exports = {
	getPadData : getPadData,
	createPad : createPad,
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