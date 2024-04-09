import type { CRU, Line, Marker, Point, SearchResult, Type } from "facilmap-types";
import { omit } from "lodash-es";
import type { FileResult } from "./files";
import type { LineString, MultiLineString, MultiPolygon, Point as GeoJSONPoint, Polygon, Position } from "geojson";
import type { Optional } from "facilmap-utils";
import type { OverpassElement } from "facilmap-leaflet";
import type { SelectedItem } from "./selection";
import type { ClientContext } from "../components/facil-map-context-provider/client-context";
import { isLineResult, isMarkerResult } from "./search";
import { useToasts } from "../components/ui/toasts/toasts.vue";
import type { FacilMapContext } from "../components/facil-map-context-provider/facil-map-context";
import { requireClientContext, requireMapContext } from "../components/facil-map-context-provider/facil-map-context-provider.vue";
import type { Ref } from "vue";
import { getI18n } from "./i18n";

export type MarkerWithTags = Omit<Marker<CRU.CREATE>, "typeId"> & { tags?: Record<string, string> };
export type LineWithTags = Omit<Line<CRU.CREATE>, "typeId"> & { tags?: Record<string, string> };

export function searchResultToMarkerWithTags(result: SearchResult | FileResult): MarkerWithTags | undefined {
	if (!isMarkerResult(result)) {
		return undefined;
	}

	return {
		tags: {
			...(result.address ? { address: result.address } : {}),
			...result.extratags
		},
		...("fmProperties" in result && result.fmProperties ? omit(result.fmProperties, ["typeId"]) : {}), // Import GeoJSON
		name: result.short_name,
		lat: result.lat ?? (result.geojson as GeoJSONPoint).coordinates[1],
		lon: result.lon ?? (result.geojson as GeoJSONPoint).coordinates[0]
	};
}

export function searchResultsToMarkersWithTags(results: Array<SearchResult | FileResult>): MarkerWithTags[] {
	return results.flatMap((result) => {
		const markerWithTags = searchResultToMarkerWithTags(result);
		return markerWithTags ? [markerWithTags] : [];
	});
}

export function searchResultToLineWithTags(result: SearchResult | FileResult): LineWithTags | undefined {
	if (!isLineResult(result)) {
		return undefined;
	}

	const line: Optional<LineWithTags, "routePoints"> = {
		tags: {
			...(result.address ? { address: result.address } : {}),
			...result.extratags
		},
		...("fmProperties" in result && result.fmProperties ? omit(result.fmProperties, ["typeId"]) : {}), // Import GeoJSON
		name: result.short_name
	};

	if (!line.routePoints) {
		const trackPoints = lineStringToTrackPoints(result.geojson as any);

		return {
			...line,
			routePoints: [trackPoints[0], trackPoints[trackPoints.length-1]],
			trackPoints: trackPoints,
			mode: "track"
		};
	} else {
		return line as LineWithTags;
	}
}

export function searchResultsToLinesWithTags(results: Array<SearchResult | FileResult>): LineWithTags[] {
	return results.flatMap((result) => {
		const lineWithTags = searchResultToLineWithTags(result);
		return lineWithTags ? [lineWithTags] : [];
	});
}

export function overpassElementsToMarkersWithTags(elements: OverpassElement[]): MarkerWithTags[] {
	return elements.map((element) => {
		return {
			name: element.tags.name || "",
			lat: element.lat,
			lon: element.lon,
			tags: element.tags,
		};
	});
}

/**
 * Maps the tags from a search result to fields whose name is similar to the tag key (ignoring case and
 * non-letters). The resulting object can be used as "data" for a marker and line.
 */
export function mapTagsToType(tags: Record<string, string>, type: Type): Record<string, string> {
	let keyMap = (keys: string[]) => {
		let ret: Record<string, string> = Object.create(null);
		for(let key of keys)
			ret[key.replace(/[^a-z0-9]/gi, "").toLowerCase()] = key;
		return ret;
	};

	let fieldKeys = keyMap(type.fields.map((field) => (field.name)));
	let resultDataKeys = keyMap(Object.keys(tags));

	const ret: Record<string, string> = Object.create(null);
	for(let key in resultDataKeys) {
		if(fieldKeys[key])
			ret[fieldKeys[key]] = tags[resultDataKeys[key]];
	}
	return ret;
}

function lineStringToTrackPoints(geometry: LineString | MultiLineString | Polygon | MultiPolygon): Point[] {
	let coords: Position[][];
	if (geometry.type == "MultiPolygon") // Take only outer ring of polygons
		coords = geometry.coordinates.map((coordArr) => coordArr[0]);
	else if (geometry.type == "MultiLineString")
		coords = geometry.coordinates;
	else if (geometry.type == "Polygon")
		coords = [geometry.coordinates[0]];
	else
		coords = [geometry.coordinates];

	return coords.flat().map((latlng) => ({ lat: latlng[1], lon: latlng[0] }));
}

export async function addMarkerToMap(client: Ref<ClientContext>, marker: MarkerWithTags, type: Type): Promise<SelectedItem> {
	const newMarker = await client.value.addMarker({
		...marker,
		data: {
			...marker.tags && mapTagsToType(marker.tags, type),
			...marker.data
		},
		typeId: type.id
	});

	return { type: "marker", id: newMarker.id };
}

export async function addLineToMap(client: Ref<ClientContext>, line: LineWithTags, type: Type): Promise<SelectedItem> {
	const newLine = await client.value.addLine({
		...line,
		typeId: type.id
	});

	return { type: "line", id: newLine.id };
}

export async function addToMap(context: FacilMapContext, objects: Array<({ marker: MarkerWithTags } | { line: LineWithTags }) & { type: Type }>): Promise<SelectedItem[]> {
	const selection: SelectedItem[] = [];

	const client = requireClientContext(context);

	for (const object of objects) {
		if ("marker" in object) {
			selection.push(await addMarkerToMap(client, object.marker, object.type));
		} else {
			selection.push(await addLineToMap(client, object.line, object.type));
		}
	}

	showAddConfirmation(context, selection);

	return selection;
}

function showAddConfirmation(context: FacilMapContext, selection: SelectedItem[]) {
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);

	const markers = selection.flatMap((item) => (item.type === "marker" ? [client.value.markers[item.id]] : []));
	const lines = selection.flatMap((item) => (item.type === "line" ? [client.value.lines[item.id]] : []));

	const objects = [...markers, ...lines].length;
	const hiddenObjects = [...markers, ...lines].filter((obj) => !mapContext.value.components.map.fmFilterFunc(obj, client.value.types[obj.typeId])).length;

	if (hiddenObjects > 0) {
		const i18n = getI18n();
		const title = () => (
			lines.length === 0 ? i18n.t("add.hidden-markers-added-title", { count: markers.length }) :
			markers.length === 0 ? i18n.t("add.hidden-lines-added-title", { count: lines.length }) :
			i18n.t("add.hidden-objects-added-title", { count: objects })
		);

		const message = () => (
			lines.length === 0 ? i18n.t("add.hidden-markers-added-message", { count: markers.length }) :
			markers.length === 0 ? i18n.t("add.hidden-lines-added-message", { count: lines.length }) :
			objects === hiddenObjects ? i18n.t("add.hidden-objects-added-message", { count: objects }) :
			i18n.t("add.hidden-objects-added-message-some", { count: objects })
		);

		const toasts = useToasts(true);
		toasts.showToast(
			undefined,
			title,
			message,
			{
				variant: "success",
				autoHide: true,
				onHidden: () => {
					toasts.dispose();
				}
			}
		);
	}
}