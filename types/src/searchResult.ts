import { Point } from "./base";

export type SearchResultType = string;

export interface SearchResult extends Point {
	short_name: string;
	display_name: string;
	address?: string;
	boundingbox?: [number, number, number, number];
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
