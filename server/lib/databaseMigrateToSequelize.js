var readline = require("readline");
var mongoose = require("mongoose");
var db = require("./databaseBackendSequelize");
var db2 = require("./database");
var utils = require("./utils");
var async = require("async");


var OLD_MARKER_COLOURS = { blue: "8da8f6", green: "90ee90", gold: "ffd700", red: "ff0000" };

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
	colour : { type: String, default: "ff0000" }
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

var typeSchema = mongoose.Schema({
	_pad : { type: String, ref: "Pad" },
	name : String,
	type : { type: String, enum: [ "marker", "line" ] },
	fields : [ Object ]
});

var Marker = mongoose.model("Marker", markerSchema);
var Line = mongoose.model("Line", lineSchema);
var LinePoints = mongoose.model("LinePoints", linePointsSchema);
var View = mongoose.model("View", viewSchema);
var Pad = mongoose.model("Pad", padSchema);
var Type = mongoose.model("Type", typeSchema);


function migrateData(title, stream, deal, callback) {
	console.log();
	console.log();
	console.log("Migrating "+title);
	console.log();

	var number = 0;
	var ended = false;

	stream.on("data", function(data) {
		data = JSON.parse(JSON.stringify(data));
		data.id = data._id;
		delete data._id;

		var queries = deal(data);
		var outstandingQueries = queries.length;

		if(queries.length == 0)
			return check();

		number++;

		for(var i=0; i<queries.length; i++) {
			queries[i].complete(function(err) {
				err && console.error(err);

				if(--outstandingQueries == 0) {
					number--;
					check();
				}
			});
		}
	});

	stream.on("error", function(err) {
		console.error(err);
		ended = true;
		check();
	});

	stream.on("end", function() {
		ended = true;
		check();
	});

	function check() {
		if(ended && number == 0)
			callback();
	}
}

var DEFAULT_MARKER_TYPE = db2._defaultTypes[0];
var DEFAULT_LINE_TYPE = db2._defaultTypes[1];


var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

console.log("Target SQL database will be cleared!");
rl.question("Please enter the MongoDB connection string [mongodb://localhost/facilpad]: ", function(connectionString) {
	rl.close();

	mongoose.connect(connectionString || "mongodb://localhost/facilpad");

	var markerTypes = { };
	var lineTypes = { };
	var markers = { };
	var lines = { };
	var views = { };

	async.series([
		function(next) {
			db.connect(next, true);
		},
		function(next) {
			migrateData("Pads", Pad.find().stream(), function(data) {
				delete data.defaultView;

				var ret = [ db._models.Pad.create(data) ];

				markerTypes[data.id] = db._models.Type.build(DEFAULT_MARKER_TYPE);
				markerTypes[data.id].PadId = data.id;
				ret.push(markerTypes[data.id].save());

				lineTypes[data.id] = db._models.Type.build(DEFAULT_LINE_TYPE);
				lineTypes[data.id].PadId = data.id;
				ret.push(lineTypes[data.id].save());

				return ret;
			}, next);
		},
		function(next) {
			migrateData("Markers", Marker.find().stream(), function(data) {
				data.lat = (data.position && data.position.lat);
				data.lon = (data.position && data.position.lon);
				delete data.position;

				data.PadId = data._pad;
				delete data._pad;

				if(data.style) {
					data.colour = OLD_MARKER_COLOURS[data.style];
					delete data.style;
				}

				data.typeId = (markerTypes[data.PadId] && markerTypes[data.PadId].id);

				var id = data.id;
				delete data.id;

				markers[id] = db._models.Marker.build(data);

				return [ markers[id].save() ];
			}, next);
		},
		function(next) {
			migrateData("MarkerData", Marker.find().stream(), function(data) {
				if(!markers[data.id].id)
					return [ ]; // Saving of marker failed

				var markerData = db._models.MarkerData.build({ name: "Description", value: data.description || "" });
				markerData.MarkerId = markers[data.id].id;
				return [ markerData.save() ];
			}, next);
		},
		function(next) {
			migrateData("Line", Line.find().stream(), function(data) {
				data.PadId = data._pad;
				delete data._pad;

				for(var i=0; i<data.points.length; i++) {
					delete data.points[i]._id;
				}

				data.typeId = (lineTypes[data.PadId] && lineTypes[data.PadId].id);

				var id = data.id;
				delete data.id;

				lines[id] = db._models.Line.build(data);

				return [ lines[id].save() ];
			}, next);
		},
		function(next) {
			migrateData("LineData", Line.find().stream(), function(data) {
				if(!lines[data.id].id)
					return [ ]; // Saving of line failed

				var lineData = db._models.LineData.build({ name: "Description", value: data.description || "" });
				lineData.LineId = lines[data.id].id;
				return [ lineData.save() ];
			}, next);
		},
		function(next) {
			migrateData("LinePoints", LinePoints.find().stream(), function(data) {
				delete data.id;

				var linePoint = db._models.LinePoint.build(data);
				linePoint.LineId = lines[data._line].id;
				return [ linePoint.save() ];
			}, next);
		},
		function(next) {
			migrateData("Views", View.find().stream(), function(data) {
				var id = data.id;
				delete data.id;

				data.top = data.view.top;
				data.left = data.view.left;
				data.bottom = data.view.bottom;
				data.right = data.view.right;
				delete data.view;

				data.PadId = data._pad;
				delete data._pad;

				views[id] = db._models.View.build(data);
				return [ views[id].save() ];
			}, next);
		},
		function(next) {
			migrateData("defaultViews", Pad.find().stream(), function(data) {
				if(!data.defaultView)
					return [ ];

				return [ db._models.Pad.update({ defaultViewId: views[data.defaultView] && views[data.defaultView].id }, { where: { id: data.id } }) ];
			}, next);
		}
	], function(err) {
		if(err)
			console.error(err);

		mongoose.disconnect();
	})
});