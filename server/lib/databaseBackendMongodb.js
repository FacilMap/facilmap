var mongoose = require("mongoose");
var config = require("../config");
var utils = require("./utils");

function connect(callback) {
	var connectionString = "mongodb://"
		+ (config.db.user ? encodeURIComponent(config.db.user) + ":" + encodeURIComponent(config.db.password) + "@" : "")
		+ config.db.host
		+ (config.db.port ? ":" + config.db.port : "")
		+ "/" + config.db.database;
	mongoose.connect(connectionString);
	callback();
}

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
	mode : { type: String, default: "" },
	colour : { type: String, default: "0000ff" },
	width : { type: Number, default: 4 },
	description : String,
	name : { type: String, default: "Untitled line" },
	distance : Number,
	time : Number
});

var linePointsSchema = mongoose.Schema(utils.extend({ }, positionType, {
	zoom : Number,
	idx : Number,
	_line : { type: ObjectId, ref: "Line" }
}));

linePointsSchema.index({ _id: 1, idx: 1 });

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
	name: { type: String, default: "New FacilPad" },
	writeId : String
});

padSchema.index({ writeId: 1 });

var Marker = mongoose.model("Marker", markerSchema);
var Line = mongoose.model("Line", lineSchema);
var LinePoints = mongoose.model("LinePoints", linePointsSchema);
var View = mongoose.model("View", viewSchema);
var Pad = mongoose.model("Pad", padSchema);

function getPadData(padId, callback) {
	Pad.findById(padId).populate("defaultView").exec(_fixIdCallback(callback));
}

function getPadDataByWriteId(writeId, callback) {
	Pad.findOne({ writeId: writeId }).populate("defaultView").exec(_fixIdCallback(callback));
}

function createPad(padId, writeId, callback) {
	Pad.create({ _id: padId, writeId: writeId }, _fixIdCallback(callback));
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
	var condition = { $and: [ _makeBboxCondition(bbox, "position."), {
		"_pad" : padId
	} ] };

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

function getPadLines(padId, fields) {
	var condition = {
		"_pad" : padId
	};

	return _fixIdStream(Line.find(condition, fields).stream());
}

function getLine(lineId, callback) {
	Line.findById(lineId, _fixIdCallback(callback));
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

function getLinePointsByBbox(lineId, bboxWithZoom, callback) {
	var condition = { $and: [ _makeBboxCondition(bboxWithZoom), {
		"_line" : lineId,
		"zoom" : { $lte: bboxWithZoom.zoom }
	} ] };

	LinePoints.find(condition, "idx zoom", { sort: "idx" }).exec(callback);
}

function getLinePointsByIdx(lineId, indexes, callback) {
	LinePoints.find({ _line: lineId, idx: { $in: indexes } }).select("lon lat idx").sort("idx").exec(callback);
}

function setLinePoints(lineId, points, callback) {
	LinePoints.remove({ _line: lineId }, function(err) {
		if(err)
			return callback(err);

		var create = [ ];
		for(var i=0; i<points.length; i++) {
			create.push(utils.extend({ }, points[i], { _line: lineId }));
		}

		if(create.length > 0)
			LinePoints.create(create, callback);
		else
			callback();
	});
}

function _fixId(data) {
	if(data != null) {
		data = JSON.parse(JSON.stringify(data));
		data.id = data._id;
		delete data._id;

		if(data.writeId)
			delete data.writeId;

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

function _makeBboxCondition(bbox, prefix) {
	prefix = prefix || "";

	function cond(key, value) {
		var ret = { };
		ret[prefix+key] = value;
		return ret;
	}

	var conditions = [ ];
	conditions.push(cond("lat", { $lte: bbox.top, $gte: bbox.bottom }));

	if(bbox.right < bbox.left) // Bbox spans over lon=180
		conditions.push({ $or: [ cond("lon", { $gte: bbox.left }), cond("lon", { $lte: bbox.right }) ] });
	else
		conditions.push(cond("lon", { $gte: bbox.left, $lte: bbox.right }));

	if(bbox.except) {
		var exceptConditions = [ ];
		exceptConditions.push({ $or: [ cond("lat", { $gt: bbox.except.top }), cond("lat", { $lt: bbox.except.bottom }) ] });

		if(bbox.except.right < bbox.except.left)
			exceptConditions.push(cond("lon", { $lt: bbox.except.left, $gt: bbox.except.right }));
		else
			exceptConditions.push({ $or: [ cond("lon", { $lt: bbox.except.left }), cond("lon", { $gt: bbox.except.right }) ] });
		conditions.push({ $or: exceptConditions });
	}

	return { $and : conditions };
}

module.exports = {
	connect : connect,
	getPadData : getPadData,
	getPadDataByWriteId : getPadDataByWriteId,
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
	getLine : getLine,
	createLine : createLine,
	updateLine : updateLine,
	deleteLine : deleteLine,
	getLinePointsByBbox : getLinePointsByBbox,
	getLinePointsByIdx : getLinePointsByIdx,
	setLinePoints : setLinePoints
};