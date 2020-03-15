import { Bbox, Point, ZoomLevel } from "./base";
import { GeoJSON } from "geojson";

export type SearchResultType = string;

export interface SearchResult extends Point {
	short_name: string;
	display_name: string;
	address: string;
	boundingbox: Bbox | null;
	zoom: ZoomLevel | null;
	extratags: Record<string, string>;
	geojson: GeoJSON | null;
	icon: Symbol;
	type: SearchResultType;
	id: string;
	ele?: number;
}
