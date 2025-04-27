import DatabaseHistory from "./history.js";
import DatabaseMaps from "./map.js";
import DatabaseViews from "./view.js";
import DatabaseLines from "./line.js";
import DatabaseTypes from "./type.js";
import DatabaseMarkers from "./marker.js";
import DatabaseSearch from "./search.js";
import DatabaseRoutes from "./route.js";
import { TypedEventEmitter } from "../utils/events.js";
import type { ID, ObjectWithId, TrackPoint, Type, View } from "facilmap-types";
import type DatabaseBackend from "../database-backend/database-backend.js";
import type { RawHistoryEntry, RawLine, RawMapData, RawMarker } from "../utils/permissions.js";

export interface DatabaseEventsInterface {
	historyEntry: [mapId: ID, newEntry: RawHistoryEntry];

	line: [mapId: ID, newLine: RawLine];
	linePoints: [mapId: ID, data: { lineId: ID; typeId: number; trackPoints: TrackPoint[]; reset: boolean }];
	deleteLine: [mapId: ID, data: ObjectWithId & { typeId: number }];

	marker: [mapId: ID, newMarker: RawMarker, oldMarker?: RawMarker];
	deleteMarker: [mapId: ID, data: ObjectWithId & { typeId: number }];

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