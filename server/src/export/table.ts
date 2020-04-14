import { streamEachPromise } from "../utils/streams";
import { promiseAuto } from "../utils/utils";
import ejs from "ejs";
import { getFrontendFile } from "../webserver";
import { ID, Line, Marker, PadId, Type } from "facilmap-types";

const commonUtils = require("facilmap-frontend/common/utils");
const commonFormat = require("facilmap-frontend/common/format");
const commonFilter = require("facilmap-frontend/common/filter");
const commonRouting = require("facilmap-frontend/common/routing");

type TypeWithObjects = Type & {
	markers: Marker[],
	lines: Line[]
}

export function createTable(database: any, padId: PadId, filter: string, hide: string[]) {
	const filterFunc = commonFilter.compileExpression(filter);

	return promiseAuto({
		padData: database.getPadData(padId),

		types: async () => {
			const types = { } as Record<ID, TypeWithObjects>;
			await streamEachPromise(database.getTypes(padId), (type: Type) => {
				types[type.id] = {
					...type,
					markers: [],
					lines: []
				};
			});
			return types;
		},

		markers: (types) => {
			return streamEachPromise(database.getPadMarkers(padId), (marker: Marker) => {
				if(filterFunc(commonFilter.prepareObject(marker, types[marker.typeId])))
					types[marker.typeId].markers.push(marker);
			});
		},

		lines: (types) => {
			return streamEachPromise(database.getPadLines(padId), (line: Line) => {
				if(filterFunc(commonFilter.prepareObject(line, types[line.typeId])))
					types[line.typeId].lines.push(line);
			});
		},

		template: getFrontendFile("table.ejs")
	}).then((results) => {
		for(let i of Object.keys(results.types) as unknown as ID[]) {
			if(results.types[i].markers.length == 0 && results.types[i].lines.length == 0)
				delete results.types[i];
		}

		return ejs.render(results.template, {
			padData: results.padData,
			types: results.types,
			utils: commonUtils,
			format: commonFormat,
			routing: commonRouting,
			hide
		})
	});
}
