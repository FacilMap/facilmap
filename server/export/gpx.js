const ejs = require("ejs");
const fs = require("fs");
const Promise = require("bluebird");

var utils = require("../utils");

let padTemplate;
Promise.promisify(fs.readFile)(`${__dirname}/gpx-pad.ejs`).then((t) => {
	padTemplate = ejs.compile(t.toString());
}).catch((err) => {
	console.error("Error reading GPX pad template", err.stack || err);
});

let lineTemplate;
Promise.promisify(fs.readFile)(`${__dirname}/gpx-line.ejs`).then((t) => {
	lineTemplate = ejs.compile(t.toString());
}).catch((err) => {
	console.error("Error reading GPX line template", err.stack || err);
});

function _dataToText(fields, data) {
	if(fields.length == 1 && fields[0].name == "Description")
		return data["Description"] || "";

	var text = [ ];
	for(var i=0; i<fields.length; i++) {
		text.push(fields[i].name + ": " + (data[fields[i].name] || ""));
	}
	return text.join('\n\n');
}

function exportGpx(database, padId, useTracks) {
	return Promise.all([
		database.getPadData(padId),
		Promise.resolve().then(() => {
			var typesObj = { };
			return utils.streamEachPromise(database.getTypes(padId), function(type) {
				typesObj[type.id] = type;
			}).then(() => typesObj);
		}),
		utils.streamToArrayPromise(database.getPadMarkers(padId)),
		utils.streamToArrayPromise(database.getPadLinesWithPoints(padId))
	]).then(([padData, types, markers, lines]) => {
		return padTemplate({
			time: utils.isoDate(),
			padData,
			types,
			markers,
			lines,
			dataToText: _dataToText,
			useTracks
		});
	});
}

function exportLine(line, type, useTracks) {
	return lineTemplate({
		useTracks: (useTracks || line.mode == "track"),
		time: utils.isoDate(),
		desc: type && _dataToText(type.fields, line.data),
		line
	});
}

module.exports = {
	exportGpx : exportGpx,
	exportLine: exportLine
};