const ejs = require("ejs");
const fs = require("fs");

const commonUtils = require("facilmap-frontend/common/utils");
const commonFormat = require("facilmap-frontend/common/format");
const commonFilter = require("facilmap-frontend/common/filter");

const utils = require("../utils");
const webserver = require("../webserver");

const table = {
	createTable(database, padId, filter) {
		const filterFunc = commonFilter.compileExpression(filter);

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
					if(filterFunc(commonFilter.prepareObject(marker, types[marker.typeId])))
						types[marker.typeId].markers.push(marker);
				});
			},

			lines: (types) => {
				return utils.streamEachPromise(database.getPadLines(padId), function(line) {
					if(filterFunc(commonFilter.prepareObject(line, types[line.typeId])))
						types[line.typeId].lines.push(line);
				});
			},

			template: webserver.getFrontendFile("table.ejs")
		}).then((results) => {
			for(let i in results.types) {
				if(results.types[i].markers.length == 0 && results.types[i].lines.length == 0)
					delete results.types[i];
			}

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