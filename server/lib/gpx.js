var database = require("./database");
var utils = require("./utils");

var async = require("async");

var _e = utils.escapeXml;

function _dataToText(fields, data) {
	var text = [ ];
	for(var i=0; i<fields.length; i++) {
		text.push(fields[i].name + ": " + (data[fields[i]] || ""));
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

function exportGpx(padId, useTracks, callback) {
	async.auto({
		padData : database.getPadData.bind(database, padId),
		views : function(next) {
			console.log("views");
			var views = '';
			utils.asyncStreamEach(database.getViews(padId), function(view, next) {
				views += '<fp:view name="' + _e(view.name) + '" baselayer="' + _e(view.baseLayer) + '" layers="' + _e(JSON.stringify(view.layers)) + '" bbox="' + _e([ view.left, view.top, view.right, view.bottom].join(',')) + '" />\n';
				next();
			}, function(err) {
				next(err, views);
			});
		},
		typesObj : function(next) {
			var types = { };
			utils.asyncStreamEach(database.getTypes(padId), function(type, next) {
				types[type.id] = type;
				next();
			}, function(err) {
				next(err, types);
			});
		},
		types : [ "typesObj", function(res, next) {
			var types = '';
			for(var i in res.typesObj) {
				var type = res.typesObj[i];
				types += '<fp:type name="' + _e(type.name) + '" type="' + _e(type.type) + '" fields="' + _e(JSON.stringify(type.fields)) + '" />\n';
			}
			next(null, types);
		} ],
		markers : [ "typesObj", function(res, next) {
			var markers = '';
			utils.asyncStreamEach(database.getPadMarkers(padId), function(marker, next) {
				markers += '<wpt lat="' + _e(marker.lat) + '" lon="' + _e(marker.lon) + '">\n' +
					'\t<name>' + _e(marker.name) + '</name>\n' +
					'\t<desc>' + _e(_dataToText(res.typesObj[marker.typeId].fields, marker.data)) + '</desc>\n' +
					'\t<extensions>\n' +
					'\t\t<fp:colour>' + _e(marker.colour) + '</fp:colour>\n' +
					'\t</extensions>\n' +
					'</wpt>\n';
				next();
			}, function(err) {
				next(err, markers);
			});
		} ],
		lines : [ "typesObj", function(res, next) {
			var lines = '';
			utils.asyncStreamEach(database.getPadLinesWithPoints(padId), function(line, next) {
				var t = (useTracks || line.mode == "track");

				lines += '<' + (t ? 'trk' : 'rte') + '>\n' +
					'\t<name>' + _e(line.name) + '</name>\n' +
					'\t<desc>' + _e(_dataToText(res.typesObj[line.typeId].fields, line.data)) + '</desc>\n' +
					'\t<extensions>\n' +
					'\t\t<fp:colour>' + _e(line.colour) + '</fp:colour>\n' +
					'\t\t<fp:width>' + _e(line.width) + '</fp:width>\n' +
					'\t\t<fp:mode>' + _e(line.mode) + '</fp:mode>\n' +
					(t && line.mode != 'track' ? '\t\t<fp:routePoints>' + _e(JSON.stringify(line.routePoints)) + '</fp:routePoints>\n' : '') +
					'\t</extensions>\n';

				if(t) {
					lines += '\t<trkseg>\n';
					for(var i=0; i<line.trackPoints.length; i++) {
						lines += '\t\t<trkpt lat="' + _e(line.trackPoints[i].lat) + '" lon="' + _e(line.trackPoints[i].lon) + '" />\n';
					}
					lines += '\t</trkseg>\n';
				} else {
					for(var i=0; i<line.routePoints.length; i++) {
						lines += '\t\t<rtept lat="' + _e(line.routePoints[i].lat) + '" lon="' + _e(line.trackPoints[i].lon) + '" />\n';
					}
				}

				lines += '</' + (t ? 'trk' : 'rte') + '>\n';

				next();
			}, function(err) {
				next(err, lines);
			});
		} ]
	}, function(err, res) {
		if(err)
			return callback(err);

		var gpx = '<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<gpx xmlns="http://www.topografix.com/GPX/1/1" creator="FacilPad" version="1.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" xmlns:fp="https://pad.facilmap.org/">\n' +
			'\t<metadata>\n' +
			'\t\t<name>' + _e(res.padData.name) + '</name>\n' +
			'\t\t<time>' + _e(utils.isoDate()) + '</time>\n' +
			'\t</metadata>\n' +
			'\t<extensions>\n' +
			res.views.replace(/^(.)/gm, '\t\t$1') +
			res.types.replace(/^(.)/gm, '\t\t$1') +
			'\t</extensions>\n' +
			res.markers.replace(/^(.)/gm, '\t$1') +
			res.lines.replace(/^(.)/gm, '\t$1') +
			'</gpx>';

		console.log(gpx);

		callback(null, gpx);
	});
}

module.exports = {
	exportGpx : exportGpx
};