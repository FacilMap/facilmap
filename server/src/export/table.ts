import { promiseAuto } from "../utils/utils.js";
import type { ID, PadId } from "facilmap-types";
import { compileExpression } from "facilmap-utils";
import Database from "../database/database.js";
import { renderTable, type TypeWithObjects } from "../frontend.js";

export function createTable(database: Database, padId: PadId, filter: string | undefined, hide: string[]): Promise<string> {
	const filterFunc = compileExpression(filter);

	return promiseAuto({
		padData: database.pads.getPadData(padId),

		types: async () => {
			const types = { } as Record<ID, TypeWithObjects>;
			for await (const type of database.types.getTypes(padId)) {
				types[type.id] = {
					...type,
					markers: [],
					lines: []
				};
			}
			return types;
		},

		markers: async (types) => {
			for await (const marker of database.markers.getPadMarkers(padId)) {
				if(filterFunc(marker, types[marker.typeId]))
					types[marker.typeId].markers.push(marker);
			}
		},

		lines: async (types) => {
			for await (const line of database.lines.getPadLines(padId)) {
				if(filterFunc(line, types[line.typeId]))
					types[line.typeId].lines.push(line);
			}
		}
	}).then((results) => {
		for(const i of Object.keys(results.types) as unknown as ID[]) {
			if(results.types[i].markers.length == 0 && results.types[i].lines.length == 0)
				delete results.types[i];
		}

		return renderTable({
			padData: results.padData,
			types: results.types,
			hide
		})
	});
}
