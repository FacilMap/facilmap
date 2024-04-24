import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { View } from "./view.js";
import type { Type } from "./type.js";
import type { ID } from "./base.js";
import type { Marker } from "./marker.js";
import type { Line } from "./line.js";

export type MarkerFeature = Feature<Point, Omit<Marker, "id" | "mapId" | "lat" | "lon" | "ele">>;
export type LineFeature = Feature<LineString, Omit<Line, "id" | "mapId" | "top" | "left" | "right" | "bottom" | "extraInfo" | "ascent" | "descent">>;

export interface GeoJsonExtensions {
	name: string;
	searchEngines: boolean;
	description: string;
	clusterMarkers: boolean;
	views: Array<Omit<View, "id" | "mapId">>;
	types: Record<ID, Omit<Type, "id" | "mapId">>;
}

export type GeoJsonExport = Omit<FeatureCollection, "features"> & {
	features: Array<MarkerFeature | LineFeature>;
	facilmap: GeoJsonExtensions;
}