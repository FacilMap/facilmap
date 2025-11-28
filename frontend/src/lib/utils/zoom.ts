import { type LatLng, latLng, type LatLngBounds, latLngBounds, type Map } from "leaflet";
import { fmToLeafletBbox, type HashQuery, type OverpassElement } from "facilmap-leaflet";
import type { RouteWithTrackPoints } from "facilmap-client";
import type { SelectedItem } from "./selection";
import type { Bbox, FindOnMapLine, FindOnMapMarker, Line, Marker, Point, SearchResult } from "facilmap-types";
import type { Geometry } from "geojson";
import { isMapResult, type MapResult } from "./search";
import { decodeLonLatUrl, decodeRouteQuery, encodeRouteQuery, normalizeLineName, normalizeMarkerName, parseRouteQuery, type ChangesetFeature, type OsmFeatureBlameSection, type ResolvedOsmFeature } from "facilmap-utils";
import { ClientContextMapState, type ClientContext } from "../components/facil-map-context-provider/client-context";
import type { FacilMapContext } from "../components/facil-map-context-provider/facil-map-context";
import { getClientSub, requireClientContext, requireMapContext } from "../components/facil-map-context-provider/facil-map-context-provider.vue";
import { toRef, type DeepReadonly } from "vue";
import storage from "./storage";

export type ZoomDestination = {
	center?: LatLng;
	zoom?: number;
	bounds?: LatLngBounds;
};

const MAX_ZOOM = 15;

export function getZoomDestinationForPoint(point: Point): ZoomDestination {
	return { center: latLng(point.lat, point.lon) };
}

export function getZoomDestinationForPoints(points: DeepReadonly<Point[]>): ZoomDestination | undefined {
	return combineZoomDestinations(points.map((point) => getZoomDestinationForPoint(point)));
}

export function getZoomDestinationForBbox(bbox: Bbox): ZoomDestination {
	return { bounds: fmToLeafletBbox(bbox) };
}

export function getZoomDestinationForGeoJSON(geojson: DeepReadonly<Geometry>): ZoomDestination | undefined {
	if (geojson.type == "GeometryCollection")
		return combineZoomDestinations(geojson.geometries.map((geo) => getZoomDestinationForGeoJSON(geo)));
	else if (geojson.type == "Point")
		return getZoomDestinationForPoint({ lat: geojson.coordinates[1], lon: geojson.coordinates[0] });
	else if (geojson.type == "LineString" || geojson.type == "MultiPoint")
		return getZoomDestinationForPoints(geojson.coordinates.map((pos) => ({ lat: pos[1], lon: pos[0] })));
	else if (geojson.type == "Polygon" || geojson.type == "MultiLineString")
		return getZoomDestinationForPoints(geojson.coordinates.flat().map((pos) => ({ lat: pos[1], lon: pos[0] })));
	else if (geojson.type == "MultiPolygon")
		return getZoomDestinationForPoints(geojson.coordinates.flat().flat().map((pos) => ({ lat: pos[1], lon: pos[0] })));
	else
		return undefined;
}

export function getZoomDestinationForMarker(marker: Marker | FindOnMapMarker | OverpassElement): ZoomDestination {
	return getZoomDestinationForPoint(marker);
}

export function getZoomDestinationForLine(line: DeepReadonly<Line | FindOnMapLine>): ZoomDestination {
	return getZoomDestinationForBbox(line);
}

export function getZoomDestinationForRoute(route: DeepReadonly<RouteWithTrackPoints>): ZoomDestination {
	return getZoomDestinationForBbox(route);
}

export function getZoomDestinationForSearchResult(result: DeepReadonly<SearchResult>): ZoomDestination | undefined {
	const dest: ZoomDestination = {};

	if (result.boundingbox)
		dest.bounds = latLngBounds([[result.boundingbox[0], result.boundingbox[3]], [result.boundingbox[1], result.boundingbox[2]]]);
	else if (result.geojson)
		dest.bounds = getZoomDestinationForGeoJSON(result.geojson)?.bounds;

	if (result.lat && result.lon)
		dest.center = latLng(Number(result.lat), Number(result.lon));
	else if (result.geojson)
		dest.center = getZoomDestinationForGeoJSON(result.geojson)?.center;

	if (result.zoom != null)
		dest.zoom = result.zoom;

	return Object.keys(dest).length == 0 ? undefined : dest;
}

export function getZoomDestinationForMapResult(result: MapResult): ZoomDestination {
	if (result.kind == "marker")
		return getZoomDestinationForMarker(result);
	else
		return getZoomDestinationForLine(result);
}

export function getZoomDestinationForResults(results: Array<SearchResult | MapResult>): ZoomDestination | undefined {
	return combineZoomDestinations(results
		.map((result) => (isMapResult(result) ? getZoomDestinationForMapResult(result) : getZoomDestinationForSearchResult(result)))
		.filter((result) => !!result) as ZoomDestination[]
	);
}

export function getZoomDestinationForChangesetFeature(feature: DeepReadonly<ChangesetFeature>): ZoomDestination | undefined {
	if (feature.type === "node") {
		if (feature.old && feature.new && (feature.old.lat !== feature.new.lat || feature.old.lon !== feature.new.lon)) {
			return {
				bounds: latLngBounds([[feature.old.lat, feature.old.lon], [feature.new.lat, feature.new.lon]]),
			};
		} else {
			return {
				center: latLng((feature.old ?? feature.new).lat, (feature.old ?? feature.new).lon)
			};
		}
	} else if (feature.type === "way") {
		return {
			bounds: latLngBounds([...feature.unchanged, ...feature.created, ...feature.deleted].flatMap((p) => p).map((p) => [p.lat, p.lon]))
		};
	}
}

export function getZoomDestinationForFeatureBlameSection(section: DeepReadonly<OsmFeatureBlameSection>): ZoomDestination {
	return combineZoomDestinations(section.paths.map((p) => {
		if (p.length === 1) {
			return {
				center: latLng(p[0].lat, p[0].lon)
			};
		} else {
			return {
				bounds: latLngBounds(p.map((n) => [n.lat, n.lon]))
			};
		}
	}))!;
}

export function getZoomDestinationForOsmFeature(feature: DeepReadonly<ResolvedOsmFeature>): ZoomDestination {
	if (feature.type === "node") {
		return getZoomDestinationForPoint(feature);
	} else {
		return getZoomDestinationForBbox(feature.bbox);
	}
}

export function combineZoomDestinations(destinations: Array<ZoomDestination | undefined>): ZoomDestination | undefined {
	if (destinations.length == 0)
		return undefined;
	else if (destinations.length == 1)
		return destinations[0];

	const bounds = latLngBounds(undefined as any);
	let one = false;
	let zoom: number | undefined = undefined;
	for (const destination of destinations) {
		if (destination) {
			one = true;
			bounds.extend((destination.bounds || destination.center)!);

			if (destination.zoom != null && (zoom == null || destination.zoom < zoom)) {
				zoom = destination.zoom;
			}
		}
	}
	if (!one) {
		return undefined;
	} else if (bounds.getNorth() === bounds.getSouth() && bounds.getWest() === bounds.getEast()) {
		return { center: latLng(bounds.getNorth(), bounds.getWest()), ...(zoom != null ? { zoom } : {}) };
	} else {
		return { bounds };
	}
}

export function normalizeZoomDestination(map: Map, destination: ZoomDestination): Required<ZoomDestination> & Pick<ZoomDestination, "bounds"> {
	const result = { ...destination };
	if (result.center == null)
		result.center = destination.bounds!.getCenter();
	if (result.zoom == null)
		result.zoom = result.bounds ? Math.min(MAX_ZOOM, map.getBoundsZoom(result.bounds)) : MAX_ZOOM;
	return result as any;
}

export function flyTo(map: Map, destination: ZoomDestination, smooth = true): void {
	const dest = normalizeZoomDestination(map, destination);
	if (map._loaded && smooth)
		map.flyTo(dest.center, dest.zoom);
	else
		map.setView(dest.center, dest.zoom, { animate: false });
}

export function getHashQuery(map: Map, client: ClientContext, items: DeepReadonly<SelectedItem>[]): HashQuery | undefined {
	if (items.length == 1) {
		if (items[0].type == "searchResult") {
			const destination = getZoomDestinationForSearchResult(items[0].result);
			if (items[0].result.id && destination)
				return { query: items[0].result.id, ...normalizeZoomDestination(map, destination), description: items[0].result.short_name };
			else
				return undefined;
		} else if (items[0].type == "marker") {
			const marker = client.map?.data?.markers[items[0].id];
			return {
				query: `m${items[0].id}`,
				...(marker ? { ...normalizeZoomDestination(map, getZoomDestinationForMarker(marker)), description: normalizeMarkerName(marker.name) } : {})
			};
		} else if (items[0].type == "line") {
			const line = client.map?.data?.lines[items[0].id];
			return {
				query: `l${items[0].id}`,
				...(line ? { ...normalizeZoomDestination(map, getZoomDestinationForLine(line)), description: normalizeLineName(line.name) } : {})
			};
		}
	}

	return undefined;
}

export async function openSpecialQuery(query: string, context: FacilMapContext, zoom: boolean, { smooth = true, forceRouteQuery = false }: { smooth?: boolean; forceRouteQuery?: boolean } = {}): Promise<boolean> {
	const mapContext = requireMapContext(context);
	const clientContext = requireClientContext(context);
	const clientSub = getClientSub(context);
	const searchBoxContext = toRef(() => context.components.searchBox);
	const routeFormTabContext = toRef(() => context.components.routeFormTab);

	if(searchBoxContext.value && routeFormTabContext.value) {
		if (storage.routeQueries || forceRouteQuery) {
			const split1 = decodeRouteQuery(query); // A route hash query encoded in a predictable format in English by the route form
			if (split1.queries.length >= 2) {
				routeFormTabContext.value.setQuery(query, zoom, smooth);
				searchBoxContext.value.activateTab(`fm${context.id}-route-form-tab`, { autofocus: true });
				return true;
			}
		}

		if (storage.routeQueries) {
			const split2 = parseRouteQuery(query); // A free-text route query specified by the user in the current language
			if (split2.queries.length >= 2) {
				routeFormTabContext.value.setQuery(encodeRouteQuery(split2), zoom, smooth);
				searchBoxContext.value.activateTab(`fm${context.id}-route-form-tab`, { autofocus: true });
				return true;
			}
		}
	}

	const lonlat = decodeLonLatUrl(query);
	if(lonlat) {
		if (zoom)
			flyTo(mapContext.value.components.map, { center: latLng(lonlat.lat, lonlat.lon), zoom: lonlat.zoom }, smooth);
		return true;
	}

	const markerId = Number(query.match(/^m(\d+)$/)?.[1]);
	const lineId = Number(query.match(/^l(\d+)$/)?.[1]);

	if ((markerId || lineId) && clientContext.value.map?.state === ClientContextMapState.OPENING) {
		await clientContext.value.map.subscription.subscribePromise;
	}

	if (markerId && clientSub.value) {
		let marker = clientSub.value.data.markers[markerId];
		if (!marker) {
			try {
				marker = await clientContext.value.client.getMarker(clientSub.value.mapSlug, markerId);
				clientContext.value.storage.storeMarker(clientSub.value.mapSlug, marker);
			} catch (err) {
				console.error("Could not find marker", err);
			}
		}

		if (marker) {
			mapContext.value.components.selectionHandler.setSelectedItems([{ type: "marker", mapSlug: clientSub.value.mapSlug, id: marker.id }], true);

			if (zoom)
				flyTo(mapContext.value.components.map, getZoomDestinationForMarker(marker), smooth);

			setTimeout(() => {
				searchBoxContext.value?.activateTab(`fm${context.id}-marker-info-tab`);
			}, 0);

			return true;
		}
	}

	if (lineId && clientSub.value?.data.lines[lineId]) {
		const line = clientSub.value.data.lines[lineId];

		mapContext.value.components.selectionHandler.setSelectedItems([{ type: "line", mapSlug: clientSub.value.mapSlug, id: line.id }], true);

		if (zoom)
			flyTo(mapContext.value.components.map, getZoomDestinationForLine(line), smooth);

		setTimeout(() => {
			searchBoxContext.value?.activateTab(`fm${context.id}-line-info-tab`);
		}, 0);

		return true;
	}

	return false;
}