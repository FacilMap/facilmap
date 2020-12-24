import { Bbox, Point, ZoomLevel } from "./base";
import { GeoJSON } from "geojson";

export type SearchResultType = string;

export interface SearchResult extends Point {
	short_name: string;
	display_name: string;
	address?: string;
	boundingbox?: [string, string, string, string];
	lat: number;
	lon: number;
	zoom?: number;
	extratags?: Record<string, string>;
	geojson?: GeoJSON.GeoJSON;
	icon?: string;
	type: SearchResultType;
	id?: string;
	elevation?: number;
}
