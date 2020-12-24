import { streamToArrayPromise } from "../utils/streams";
import ejs from "ejs";
import fs from "fs";
import Database from "../database/database";
import { Field, PadId, Type } from "facilmap-types";
import { compileExpression, prepareObject } from "facilmap-frontend/common/filter";
import { Line } from "../../../types/src";
import { keyBy } from "lodash";


const padTemplateP = fs.promises.readFile(`${__dirname}/gpx-pad.ejs`).then((t) => {
	return ejs.compile(t.toString());
});

let lineTemplateP = fs.promises.readFile(`${__dirname}/gpx-line.ejs`).then((t) => {
	return ejs.compile(t.toString());
});

function dataToText(fields: Field[], data: Record<string, string>) {
	if(fields.length == 1 && fields[0].name == "Description")
		return data["Description"] || "";

	const text = [ ];
	for(let i=0; i<fields.length; i++) {
		text.push(fields[i].name + ": " + (data[fields[i].name] || ""));
	}
	return text.join('\n\n');
}

export async function exportGpx(database: Database, padId: PadId, useTracks: boolean, filter: string) {
	const filterFunc = compileExpression(filter);

	const typesP = streamToArrayPromise(database.types.getTypes(padId)).then((types) => keyBy(types, 'id'));

	const [ padData, types, markers, lines, padTemplate ] = await Promise.all([
		database.pads.getPadData(padId),
		typesP,
		typesP.then(async (types) => (
			await streamToArrayPromise(database.markers.getPadMarkers(padId).filter((marker) => filterFunc(prepareObject(marker, types[marker.typeId]))))
		)),
		typesP.then(async (types) => (
			await streamToArrayPromise(database.lines.getPadLinesWithPoints(padId).filter((line) => filterFunc(prepareObject(line, types[line.typeId]))))
		)),
		padTemplateP
	]);

	return padTemplate({
		time: new Date().toISOString(),
		padData,
		types,
		markers,
		lines,
		dataToText,
		useTracks
	});
}

export async function exportLineToGpx(line: Line, type: Type, useTracks: boolean) {
	const lineTemplate = await lineTemplateP;

	return lineTemplate({
		useTracks: (useTracks || line.mode == "track"),
		time: new Date().toISOString(),
		desc: type && dataToText(type.fields, line.data),
		line
	});
}
