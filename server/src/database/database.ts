import DatabaseHistory from "./history.js";
import DatabaseMaps from "./map.js";
import DatabaseViews from "./view.js";
import DatabaseLines from "./line.js";
import DatabaseTypes from "./type.js";
import DatabaseMarkers from "./marker.js";
import DatabaseSearch from "./search.js";
import DatabaseRoutes from "./route.js";
import { TypedEventEmitter } from "../utils/events.js";
import type { ID, Line, Marker, ObjectWithId, TrackPoint, Type, View } from "facilmap-types";
import type DatabaseBackend from "../database-backend/database-backend.js";
import type { RawHistoryEntry, RawMapData } from "../utils/permissions.js";

export interface DatabaseEventsInterface {
	historyEntry: [mapId: ID, newEntry: RawHistoryEntry];

	line: [mapId: ID, newLine: Line];
	linePoints: [mapId: ID, lineId: ID, points: TrackPoint[], reset: boolean];
	deleteLine: [mapId: ID, data: ObjectWithId];

	marker: [mapId: ID, newMarker: Marker, oldMarker?: Marker];
	deleteMarker: [mapId: ID, data: ObjectWithId];

	mapData: [mapId: ID, mapData: RawMapData];
	deleteMap: [mapId: ID];

	type: [mapId: ID, newType: Type];
	deleteType: [mapId: ID, data: ObjectWithId];

	view: [mapId: ID, newView: View];
	deleteView: [mapId: ID, data: ObjectWithId];
}

export type DatabaseEvents = Pick<DatabaseEventsInterface, keyof DatabaseEventsInterface>; // Workaround for https://github.com/microsoft/TypeScript/issues/15300

export default class Database extends TypedEventEmitter<DatabaseEvents> {

	backend: DatabaseBackend;
	history: DatabaseHistory;
	maps: DatabaseMaps;
	views: DatabaseViews;
	markers: DatabaseMarkers;
	lines: DatabaseLines;
	types: DatabaseTypes;
	search: DatabaseSearch;
	routes: DatabaseRoutes;

	constructor(backend: DatabaseBackend) {
		super();

		this.backend = backend;

		this.history = new DatabaseHistory(this);
		this.maps = new DatabaseMaps(this);
		this.views = new DatabaseViews(this);
		this.markers = new DatabaseMarkers(this);
		this.lines = new DatabaseLines(this);
		this.types = new DatabaseTypes(this);
		this.search = new DatabaseSearch(this);
		this.routes = new DatabaseRoutes(this);
	}
}