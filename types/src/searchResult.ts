import type { Geometry } from "geojson";

export type SearchResultType = string;

export interface SearchResult {
	short_name: string;
	display_name: string;
	address?: string;
	boundingbox?: [number, number, number, number];
	lat?: number;
	lon?: number;
	zoom?: number;
	extratags?: Record<string, string>;
	geojson?: Geometry;
	icon?: string;
	type: SearchResultType;
	id?: string;
	elevation?: number;
}
