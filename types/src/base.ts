export type Latitude = number;
export type Longitude = number;
export type ZoomLevel = number;
export type Colour = string;
export type Symbol = string;
export type Shape = "" | "drop" | "circle";
export type ID = number;
export type RouteMode = string;
export type Layer = string;
export type ExportFormat = "gpx-trk" | "gpx-rte";

export interface Point {
	lat: Latitude;
	lon: Longitude;
}

export interface Bbox {
	top: Latitude;
	bottom: Latitude;
	left: Longitude;
	right: Longitude;
}

export interface BboxWithZoom extends Bbox {
	zoom: ZoomLevel;
}

export type ObjectWithId = {
	id: ID;
}

export type AllOptionalExceptId<T extends ObjectWithId> = Pick<T, "id"> & Partial<Omit<T, "id">>;
