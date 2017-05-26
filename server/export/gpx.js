const ejs = require("ejs");
const fs = require("fs");
const Promise = require("bluebird");

var utils = require("../utils");

var _e = utils.escapeXml;

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

function _textToData(fields, text) {
	function hasField(fieldName) {
		for(var i=0; i<fields.length; i++) {
			if(fields[i].name == fieldName)
				return true;
		}
		return false;
	}

	var textSplit = text.replace(/\r/g, '').split('\n\n');
	var ret = { };
	var lastField = null;
	for(var i=0; i<textSplit.length; i++) {
		if(textSplit[i].indexOf(': ') != -1) {
			var spl = textSplit[i].split(': ', 2);
			if(hasField(spl[0])) {
				lastField = spl[0];
				ret[lastField] = spl[1];
				continue;
			}
		}

		if(lastField == null) {
			lastField = 'Description';
			ret[lastField] = textSplit[i];
		} else {
			ret[lastField] += '\n\n' + textSplit[i];
		}
	}

	return ret;
}

function exportGpx(database, padId, useTracks) {
	return utils.promiseAuto({
		padData: database.getPadData(padId),

		typesObj: () => {
			var typesObj = { };
			return utils.streamEachPromise(database.getTypes(padId), function(type) {
				typesObj[type.id] = type;
			}).then(() => typesObj);
		},

		markers: (typesObj) => {
			var markers = '';
			return utils.streamEachPromise(database.getPadMarkers(padId), function(marker) {
				markers += '<wpt lat="' + _e(marker.lat) + '" lon="' + _e(marker.lon) + '"' + (marker.ele != null ? ' ele="' + _e(marker.ele) + '"' : '') + '>\n' +
					'\t<name>' + _e(marker.name) + '</name>\n' +
					'\t<desc>' + _e(_dataToText(typesObj[marker.typeId].fields, marker.data)) + '</desc>\n' +
					'</wpt>\n';
			}).then(() => markers);
		},

		lines: (typesObj) => {
			var lines = '';
			return utils.streamEachPromise(database.getPadLinesWithPoints(padId), function(line) {
				var t = (useTracks || line.mode == "track");

				lines += '<' + (t ? 'trk' : 'rte') + '>\n' +
					'\t<name>' + _e(line.name) + '</name>\n' +
					'\t<desc>' + _e(_dataToText(typesObj[line.typeId].fields, line.data)) + '</desc>\n';

				if(t) {
					lines += '\t<trkseg>\n';
					for(var i=0; i<line.trackPoints.length; i++) {
						lines += '\t\t<trkpt lat="' + _e(line.trackPoints[i].lat) + '" lon="' + _e(line.trackPoints[i].lon) + '"' + (line.trackPoints[i].ele != null ? ' ele="' + _e(line.trackPoints[i].ele) + '"' : '') + ' />\n';
					}
					lines += '\t</trkseg>\n';
				} else {
					for(var i=0; i<line.routePoints.length; i++) {
						lines += '\t\t<rtept lat="' + _e(line.routePoints[i].lat) + '" lon="' + _e(line.trackPoints[i].lon) + '" />\n';
					}
				}

				lines += '</' + (t ? 'trk' : 'rte') + '>\n';
			}).then(() => lines);
		}
	}).then((res) => '<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<gpx xmlns="http://www.topografix.com/GPX/1/1" creator="FacilMap" version="1.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" xmlns:fm="https://facilmap.org/">\n' +
		'\t<metadata>\n' +
		'\t\t<name>' + _e(res.padData.name) + '</name>\n' +
		'\t\t<time>' + _e(utils.isoDate()) + '</time>\n' +
		'\t</metadata>\n' +
		res.markers.replace(/^(.)/gm, '\t$1') +
		res.lines.replace(/^(.)/gm, '\t$1') +
		'</gpx>'
	);
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