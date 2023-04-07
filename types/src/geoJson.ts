import { Feature, FeatureCollection, LineString, Point } from "geojson";
import { View } from "./view.js";
import { Type } from "./type.js";
import { ID } from "./base.js";
import { Marker } from "./marker.js";
import { Line } from "./line.js";

export type MarkerFeature = Feature<Point, Omit<Marker, "id" | "padId" | "lat" | "lon">>;
export type LineFeature = Feature<LineString, Omit<Line, "id" | "padId" | "top" | "left" | "right" | "bottom">>;

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