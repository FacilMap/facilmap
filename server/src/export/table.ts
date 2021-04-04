import { streamEachPromise } from "../utils/streams";
import { promiseAuto } from "../utils/utils";
import ejs from "ejs";
import { getFrontendFile } from "../webserver";
import { ID, Line, Marker, PadId, Type } from "facilmap-types";
import { compileExpression } from "facilmap-utils";
import * as utils from "facilmap-utils";
import Database from "../database/database";

type TypeWithObjects = Type & {
	markers: Marker[],
	lines: Line[]
}

export function createTable(database: Database, padId: PadId, filter: string | undefined, hide: string[]): Promise<string> {
	const filterFunc = compileExpression(filter);

	return promiseAuto({
		padData: database.pads.getPadData(padId),

		types: async () => {
			const types = { } as Record<ID, TypeWithObjects>;
			await streamEachPromise(database.types.getTypes(padId), (type: Type) => {
				types[type.id] = {
					...type,
					markers: [],
					lines: []
				};
			});
			return types;
		},

		markers: (types) => {
			return streamEachPromise(database.markers.getPadMarkers(padId), (marker: Marker) => {
				if(filterFunc(marker, types[marker.typeId]))
					types[marker.typeId].markers.push(marker);
			});
		},

		lines: (types) => {
			return streamEachPromise(database.lines.getPadLines(padId), (line: Line) => {
				if(filterFunc(line, types[line.typeId]))
					types[line.typeId].lines.push(line);
			});
		},

		template: getFrontendFile("table.ejs")
	}).then((results) => {
		for(const i of Object.keys(results.types) as unknown as ID[]) {
			if(results.types[i].markers.length == 0 && results.types[i].lines.length == 0)
				delete results.types[i];
		}

		return ejs.render(results.template, {
			padData: results.padData,
			types: results.types,
			utils,
			hide
		})
	});
}
