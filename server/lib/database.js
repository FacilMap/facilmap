var mongoose = require("mongoose");
var config = require("../config");

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
	name : String,
	description : String,
	style : String
});

var lineSchema = mongoose.Schema({
	_pad : { type: String, ref: "Pad" },
	points : [positionType],
	actualPoints : [positionType],
	routingType : String,
	colour : String,
	width : Number,
	description : String,
	name : String
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
var Line = mongoose.model("Line", markerSchema);
var View = mongoose.model("View", viewSchema);
var Pad = mongoose.model("Pad", padSchema);

function getPadData(padId, callback) {
	Pad.findById(padId).populate("defaultView").exec(function(err, pad) {
		if(!err && pad == null) {
			Pad.create({ _id: padId }, function(err) {
				if(err)
					return callback;

				getPadData(padId, callback);
			});
		}
		else
			callback(err, pad);
	});
}

function updatePadData(padId, data, callback) {
	Pad.findByIdAndUpdate(padId, data).populate("defaultView").exec(callback);
}

function getViews(padId) {
	return View.find({ "_pad" : padId }).stream();
}

function createView(padId, data, callback) {
	data._pad = padId;
	View.create(data, callback);
}

function updateView(viewId, data, callback) {
	View.findByIdAndUpdate(viewId, data, callback);
}

function deleteView(viewId, callback) {
	View.remove({ _id: viewId }, callback);
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

	return Marker.find(condition).stream();
}

function createMarker(padId, data, callback) {
	data._pad = padId;
	Marker.create(data, callback);
}

function updateMarker(markerId, data, callback) {
	Marker.findByIdAndUpdate(markerId, data, callback);
}

function deleteMarker(markerId, callback) {
	Marker.remove({ _id: markerId }, callback);
}

function getPadLines(padId, bbox) {
	var condition = { // TODO
		"_pad" : padId
	};

	return Line.find(condition).stream();
}

function createLine(padId, data, callback) {
	data._pad = padId;
	Line.create(data, callback);
}

function updateLine(lineId, data, callback) {
	Line.findByIdAndUpdate(lineId, data, callback);
}

function deleteLine(lineId, callback) {
	Line.remove({ _id: lineId }, callback);
}

module.exports = {
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