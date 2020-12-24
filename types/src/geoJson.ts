import { GeoJSON } from "geojson";
import { View } from "./view";
import { Type } from "./type";
import { ID } from "./base";

export interface GeoJsonExtensions {
	name: string;
	searchEngines: boolean;
	description: string;
	clusterMarkers: boolean;
	views: Array<View>;
	types: Record<ID, Type>;
}

export type GeoJsonExport = GeoJSON & {
	facilmap: GeoJsonExtensions;
}