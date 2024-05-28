import { iterableToArray, iterableToStream, getZipEncodeStream, indentStream, stringToStream, type ZipEncodeStreamItem, streamToIterable } from "../utils/streams.js";
import Database from "../database/database.js";
import type { Field, Line, Marker, TrackPoint, Type, LineWithTrackPoints, ID } from "facilmap-types";
import { compileExpression, getSafeFilename, normalizeLineName, normalizeMarkerName, normalizeMapName, quoteHtml } from "facilmap-utils";
import { keyBy } from "lodash-es";
import { getI18n } from "../i18n.js";

const gpxHeader = (
	`<?xml version="1.0" encoding="UTF-8"?>\n` +
	`<gpx xmlns="http://www.topografix.com/GPX/1/1" creator="FacilMap" version="1.1" xmlns:osmand="https://osmand.net" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">`
);

const gpxFooter = (
	`</gpx>`
);

const markerShapeToOsmand: Record<string, string> = {
	"drop": "circle",
	"rectangle-marker": "square",
	"circle": "circle",
	"rectangle": "square",
	"diamond": "octagon",
	"pentagon": "octagon",
	"hexagon": "octagon",
	"triangle": "circle",
	"triangle-down": "circle",
	"star": "octagon"
};

function dataToText(fields: Field[], data: Record<string, string>) {
	if(fields.length == 1 && fields[0].name == "Description")
		return data["Description"] || "";

	const text = [ ];
	for(let i=0; i<fields.length; i++) {
		text.push(fields[i].name + ": " + (data[fields[i].name] || ""));
	}
	return text.join('\n\n');
}

function getMetadataGpx(data: { name: string; extensions?: Record<string, string> }, otherExtensions?: Record<string, string>): string {
	const { extensions, ...otherData } = data;
	return (
		`<metadata>\n` +
		Object.entries({
			time: new Date().toISOString(),
			...otherData
		}).map(([k, v]) => `\t<${quoteHtml(k)}>${quoteHtml(v)}</${quoteHtml(k)}>\n`).join("") +
		(extensions && Object.keys(extensions).length > 0 ? (
			`\t<extensions>\n` +
			Object.entries(extensions).map(([k, v]) => `\t\t<${quoteHtml(k)}>${quoteHtml(v)}</${quoteHtml(k)}>\n`).join("") +
			`\t</extensions>\n`
		) : "") +
		`</metadata>` +
		(otherExtensions && Object.keys(otherExtensions).length > 0 ? (
			`\n` +
			`<extensions>\n` +
			Object.entries(otherExtensions).map(([k, v]) => `\t<${quoteHtml(k)}>${quoteHtml(v)}</${quoteHtml(k)}>\n`).join("") +
			`</extensions>`
		) : "")
	);
}

function getMarkerGpx(marker: Marker, type: Type): ReadableStream<string> {
	const osmandBackground = markerShapeToOsmand[marker.shape || "drop"];
	return stringToStream(
		`<wpt lat="${quoteHtml(marker.lat)}" lon="${quoteHtml(marker.lon)}"${marker.ele != null ? ` ele="${quoteHtml(marker.ele)}"` : ""}>\n` +
		`\t<name>${quoteHtml(normalizeMarkerName(marker.name))}</name>\n` +
		`\t<desc>${quoteHtml(dataToText(type.fields, marker.data))}</desc>\n` +
		`\t<extensions>\n` +
		(osmandBackground ? `\t\t<osmand:background>${osmandBackground}</osmand:background>\n` : "") +
		`\t\t<osmand:color>#aa${marker.colour}</osmand:color>\n` +
		`\t</extensions>\n` +
		`</wpt>`
	);
}

function getLineRouteGpx(line: LineForExport, type: Type | undefined): ReadableStream<string> {
	return stringToStream(
		`<rte>\n` +
		`\t<name>${quoteHtml(normalizeLineName(line.name))}</name>\n` +
		(type ? `\t<desc>${quoteHtml(dataToText(type.fields, line.data ?? {}))}</desc>\n` : "") +
		line.routePoints.map((routePoint) => (
			`\t<rtept lat="${quoteHtml(routePoint.lat)}" lon="${quoteHtml(routePoint.lon)}" />\n`
		)).join("") +
		`</rte>`
	);
}

function getLineTrackGpx(line: LineForExport, type: Type | undefined, trackPoints: AsyncIterable<TrackPoint>): ReadableStream<string> {
	return iterableToStream((async function*() {
		yield (
			`<trk>\n` +
			`\t<name>${quoteHtml(normalizeLineName(line.name))}</name>\n` +
			(type ? `\t<desc>${quoteHtml(dataToText(type.fields, line.data ?? {}))}</desc>\n` : "") +
			`\t<trkseg>\n`
		);
		for await (const trackPoint of trackPoints) {
			yield `\t\t<trkpt lat="${quoteHtml(trackPoint.lat)}" lon="${quoteHtml(trackPoint.lon)}"${trackPoint.ele != null ? ` ele="${quoteHtml(trackPoint.ele)}"` : ""} />\n`;
		}
		yield (
			`\t</trkseg>\n` +
			`</trk>`
		);
	})());
}

export function exportGpx(database: Database, mapId: ID, useTracks: boolean, filter?: string): ReadableStream<string> {
	return iterableToStream((async function* () {
		const filterFunc = compileExpression(filter);

		const [mapData, types] = await Promise.all([
			database.maps.getMapData(mapId),
			iterableToArray(database.types.getTypes(mapId)).then((types) => keyBy(types, 'id'))
		]);

		if (!mapData)
			throw new Error(getI18n().t("map-not-found-error", { mapId }));

		yield (
			`${gpxHeader}\n` +
			`\t${getMetadataGpx({ name: normalizeMapName(mapData.name) }).replaceAll("\n", "\n\t")}\n`
		);

		for await (const marker of database.markers.getMapMarkers(mapId)) {
			if (filterFunc(marker, types[marker.typeId])) {
				for await (const chunk of streamToIterable(getMarkerGpx(marker, types[marker.typeId]).pipeThrough(indentStream({ indent: "\t", indentFirst: true, addNewline: true })))) {
					yield chunk;
				}
			}
		}

		for await (const line of database.lines.getMapLines(mapId)) {
			if (filterFunc(line, types[line.typeId])) {
				if (useTracks || line.mode == "track") {
					const trackPoints = database.lines.getLinePointsForLine(line.id);
					for await (const chunk of streamToIterable(getLineTrackGpx(line, types[line.typeId], trackPoints).pipeThrough(indentStream({ indent: "\t", indentFirst: true, addNewline: true })))) {
						yield chunk;
					}
				} else {
					for await (const chunk of streamToIterable(getLineRouteGpx(line, types[line.typeId]).pipeThrough(indentStream({ indent: "\t", indentFirst: true, addNewline: true })))) {
						yield chunk;
					}
				}
			}
		}

		yield gpxFooter;
	})());
}

export function exportGpxZip(database: Database, mapId: ID, useTracks: boolean, filter?: string): ReadableStream<Uint8Array> {
	const encodeZipStream = getZipEncodeStream();

	void iterableToStream((async function*(): AsyncIterable<ZipEncodeStreamItem> {
		const filterFunc = compileExpression(filter);

		const [mapData, types] = await Promise.all([
			database.maps.getMapData(mapId),
			iterableToArray(database.types.getTypes(mapId)).then((types) => keyBy(types, 'id'))
		]);

		if (!mapData) {
			throw new Error(getI18n().t("map-not-found-error", { mapId }));
		}

		yield {
			filename: "markers.gpx",
			data: iterableToStream((async function*() {
				yield (
					`${gpxHeader}\n` +
					`\t${getMetadataGpx({ name: normalizeMapName(mapData.name) }).replaceAll("\n", "\n\t")}\n`
				);

				for await (const marker of database.markers.getMapMarkers(mapId)) {
					if (filterFunc(marker, types[marker.typeId])) {
						for await (const chunk of streamToIterable(getMarkerGpx(marker, types[marker.typeId]).pipeThrough(indentStream({ indent: "\t", indentFirst: true, addNewline: true })))) {
							yield chunk;
						}
					}
				}

				yield gpxFooter;
			})())
		};

		yield {
			filename: "lines/",
			data: null
		};

		const names = new Set<string>();

		for await (const line of database.lines.getMapLines(mapId)) {
			if (filterFunc(line, types[line.typeId])) {
				const lineName = normalizeLineName(line.name);
				let name = lineName;
				for (let i = 1; names.has(name); i++) {
					name = `${lineName} (${i})`;
				}
				names.add(name);

				const filename = `lines/${getSafeFilename(name)}.gpx`;

				if (useTracks || line.mode == "track") {
					const trackPoints = database.lines.getLinePointsForLine(line.id);
					yield {
						filename,
						data: exportLineToTrackGpx(line, types[line.typeId], trackPoints)
					};
				} else {
					yield {
						filename,
						data: exportLineToRouteGpx(line, types[line.typeId])
					};
				}
			}
		}
	})()).pipeTo(encodeZipStream.writable);

	return encodeZipStream.readable;
}

type LineForExport = Pick<LineWithTrackPoints, "name" | "data" | "mode" | "routePoints"> & Partial<Pick<Line, "colour" | "width">>;

function getLineMetadataGpx(line: LineForExport, type: Type | undefined): string {
	return getMetadataGpx({
		name: normalizeLineName(line.name),
		extensions: {
			...(type ? {
				"osmand:desc": dataToText(type.fields, line.data)
			} : {})
		}
	}, {
		...(line.colour ? {
			"osmand:color": `#aa${line.colour}`
		} : {}),
		...(line.width ? {
			"osmand:width": `${line.width}`
		} : {})
	});
}

export function exportLineToTrackGpx(line: LineForExport, type: Type | undefined, trackPoints: AsyncIterable<TrackPoint>): ReadableStream<string> {
	return iterableToStream((async function*() {
		yield (
			`${gpxHeader}\n` +
			`\t${getLineMetadataGpx(line, type).replaceAll("\n", "\n\t")}\n`
		);

		for await (const chunk of streamToIterable(getLineTrackGpx(line, type, trackPoints).pipeThrough(indentStream({ indent: "\t", indentFirst: true, addNewline: true })))) {
			yield chunk;
		}

		yield gpxFooter;
	})());
}

export function exportLineToRouteGpx(line: LineForExport, type: Type | undefined): ReadableStream<string> {
	return iterableToStream((async function*() {
		yield (
			`${gpxHeader}\n` +
			`\t${getLineMetadataGpx(line, type).replaceAll("\n", "\n\t")}\n`
		);

		for await (const chunk of streamToIterable(getLineRouteGpx(line, type).pipeThrough(indentStream({ indent: "\t", indentFirst: true, addNewline: true })))) {
			yield chunk;
		}

		yield gpxFooter;
	})());
}
