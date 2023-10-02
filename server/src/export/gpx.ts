import { asyncIteratorToArray, asyncIteratorToStream } from "../utils/streams.js";
import { compile } from "ejs";
import Database from "../database/database.js";
import { Field, PadId, Type } from "facilmap-types";
import { compileExpression, quoteHtml } from "facilmap-utils";
import { LineWithTrackPoints } from "../database/line.js";
import { keyBy } from "lodash-es";
import gpxLineEjs from "./gpx-line.ejs?raw";

const lineTemplate = compile(gpxLineEjs);

function dataToText(fields: Field[], data: Record<string, string>) {
	if(fields.length == 1 && fields[0].name == "Description")
		return data["Description"] || "";

	const text = [ ];
	for(let i=0; i<fields.length; i++) {
		text.push(fields[i].name + ": " + (data[fields[i].name] || ""));
	}
	return text.join('\n\n');
}

export function exportGpx(database: Database, padId: PadId, useTracks: boolean, filter?: string): ReadableStream<string> {
	return asyncIteratorToStream((async function* () {
		const filterFunc = compileExpression(filter);

		const [padData, types] = await Promise.all([
			database.pads.getPadData(padId),
			asyncIteratorToArray(database.types.getTypes(padId)).then((types) => keyBy(types, 'id'))
		]);

		if (!padData)
			throw new Error(`Pad ${padId} could not be found.`);

		yield (
			`<?xml version="1.0" encoding="UTF-8"?>\n` +
			`<gpx xmlns="http://www.topografix.com/GPX/1/1" creator="FacilMap" version="1.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n` +
			`\t<metadata>\n` +
			`\t\t<name>${quoteHtml(padData.name)}</name>\n` +
			`\t\t<time>${quoteHtml(new Date().toISOString())}</time>\n` +
			`\t</metadata>\n`
		);

		for await (const marker of database.markers.getPadMarkers(padId)) {
			if (filterFunc(marker, types[marker.typeId])) {
				yield (
					`\t<wpt lat="${quoteHtml(marker.lat)}" lon="${quoteHtml(marker.lon)}"${marker.ele != null ? ` ele="${quoteHtml(marker.ele)}"` : ""}>\n` +
					`\t\t<name>${quoteHtml(marker.name)}</name>\n` +
					`\t\t<desc>${quoteHtml(dataToText(types[marker.typeId].fields, marker.data))}</desc>\n` +
					`\t</wpt>\n`
				);
			}
		}

		for await (const line of database.lines.getPadLinesWithPoints(padId)) {
			if (filterFunc(line, types[line.typeId])) {
				if (useTracks || line.mode == "track") {
					yield (
						`\t<trk>\n` +
						`\t\t<name>${quoteHtml(line.name)}</name>\n` +
						`\t\t<desc>${dataToText(types[line.typeId].fields, line.data)}</desc>\n` +
						`\t\t<trkseg>\n` +
						line.trackPoints.map((trackPoint) => (
							`\t\t\t<trkpt lat="${quoteHtml(trackPoint.lat)}" lon="${quoteHtml(trackPoint.lon)}"${trackPoint.ele != null ? ` ele="${quoteHtml(trackPoint.ele)}"` : ""} />\n`
						)).join("") +
						`\t\t</trkseg>\n` +
						`\t</trk>\n`
					);
				} else {
					yield (
						`\t<rte>\n` +
						`\t\t<name>${quoteHtml(line.name)}</name>\n` +
						`\t\t<desc>${quoteHtml(dataToText(types[line.typeId].fields, line.data))}</desc>\n` +
						line.routePoints.map((routePoint) => (
							`\t\t<rtept lat="${quoteHtml(routePoint.lat)}" lon="${quoteHtml(routePoint.lon)}" />\n`
						)).join("") +
						`\t</rte>\n`
					);
				}
			}
		}

		yield `</gpx>`;
	})());
}

type LineForExport = Partial<Pick<LineWithTrackPoints, "name" | "data" | "mode" | "trackPoints" | "routePoints">>;

export async function exportLineToGpx(line: LineForExport, type: Type | undefined, useTracks: boolean): Promise<string> {
	return lineTemplate({
		useTracks: (useTracks || line.mode == "track"),
		time: new Date().toISOString(),
		desc: type && dataToText(type.fields, line.data ?? {}),
		line
	});
}
