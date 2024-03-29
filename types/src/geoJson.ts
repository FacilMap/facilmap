import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { View } from "./view.js";
import type { Type } from "./type.js";
import type { ID } from "./base.js";
import type { Marker } from "./marker.js";
import type { Line } from "./line.js";

export type MarkerFeature = Feature<Point, Omit<Marker, "id" | "padId" | "lat" | "lon" | "ele">>;
export type LineFeature = Feature<LineString, Omit<Line, "id" | "padId" | "top" | "left" | "right" | "bottom" | "extraInfo" | "ascent" | "descent">>;

export interface GeoJsonExtensions {
	name: string;
	searchEngines: boolean;
	description: string;
	clusterMarkers: boolean;
	views: Array<Omit<View, "id" | "padId">>;
	types: Record<ID, Omit<Type, "id" | "padId">>;
}

export type GeoJsonExport = Omit<FeatureCollection, "features"> & {
	features: Array<MarkerFeature | LineFeature>;
	facilmap: GeoJsonExtensions;
}