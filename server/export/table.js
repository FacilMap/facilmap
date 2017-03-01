const ejs = require("ejs");
const fs = require("fs");
const Promise = require("promise");

const commonUtils = require("facilmap-frontend/common/utils");
const commonFormat = require("facilmap-frontend/common/format");

const utils = require("../utils");
const webserver = require("../webserver");

const table = {
	createTable(database, padId) {
		return utils.promiseAuto({
			padData: database.getPadData(padId),

			types: () => {
				var types = { };
				return utils.streamEachPromise(database.getTypes(padId), function(type) {
					types[type.id] = type;
					type.markers = [];
					type.lines = [];
				}).then(() => types);
			},

			markers: (types) => {
				return utils.streamEachPromise(database.getPadMarkers(padId), function(marker) {
					types[marker.typeId].markers.push(marker);
				});
			},

			lines: (types) => {
				return utils.streamEachPromise(database.getPadLines(padId), function(line) {
					types[line.typeId].lines.push(line);
				});
			},

			template: webserver.getFrontendFile("table.ejs")
		}).then((results) => {
			return ejs.render(results.template, {
				padData: results.padData,
				types: results.types,
				utils: commonUtils,
				format: commonFormat
			})
		})
	}
};

Object.assign(exports, table);