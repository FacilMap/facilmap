import { Sequelize } from "sequelize";
import debug from "debug";
import DatabaseHelpers from "./helpers.js";
import DatabaseHistory from "./history.js";
import type { DbConfig } from "../config.js";
import DatabaseMaps from "./map.js";
import DatabaseViews from "./view.js";
import DatabaseLines from "./line.js";
import DatabaseTypes from "./type.js";
import DatabaseMarkers from "./marker.js";
import DatabaseMeta from "./meta.js";
import DatabaseSearch from "./search.js";
import DatabaseRoutes from "./route.js";
import DatabaseMigrations from "./migrations.js";
import { TypedEventEmitter } from "../utils/events.js";
import type { HistoryEntry, ID, Line, Marker, ObjectWithId, MapData, MapId, TrackPoint, Type, View } from "facilmap-types";

export interface DatabaseEventsInterface {
	addHistoryEntry: [mapId: MapId, newEntry: HistoryEntry];
	historyChange: [mapId: MapId];

	line: [mapId: MapId, newLine: Line];
	linePoints: [mapId: MapId, lineId: ID, points: TrackPoint[]];
	deleteLine: [mapId: MapId, data: ObjectWithId];

	marker: [mapId: MapId, newMarker: Marker];
	deleteMarker: [mapId: MapId, data: ObjectWithId];

	mapData: [mapId: MapId, mapData: MapData];
	deleteMap: [mapId: MapId];

	type: [mapId: MapId, newType: Type];
	deleteType: [mapId: MapId, data: ObjectWithId];

	view: [mapId: MapId, newView: View];
	deleteView: [mapId: MapId, data: ObjectWithId];
}

export type DatabaseEvents = Pick<DatabaseEventsInterface, keyof DatabaseEventsInterface>; // Workaround for https://github.com/microsoft/TypeScript/issues/15300

export default class Database extends TypedEventEmitter<DatabaseEvents> {

	_conn: Sequelize;
	helpers: DatabaseHelpers;
	history: DatabaseHistory;
	maps: DatabaseMaps;
	views: DatabaseViews;
	markers: DatabaseMarkers;
	lines: DatabaseLines;
	types: DatabaseTypes;
	meta: DatabaseMeta;
	search: DatabaseSearch;
	routes: DatabaseRoutes;
	migrations: DatabaseMigrations;

	constructor(dbConfig: DbConfig) {
		super();

		this._conn = new Sequelize(dbConfig.database, dbConfig.user, dbConfig.password, {
			dialect: dbConfig.type,
			host: dbConfig.host,
			port: dbConfig.port,
			define: {
				timestamps: false,
				charset: "utf8mb4",
				collate: "utf8mb4_general_ci"
			},
			logging: debug.enabled("sql") ? console.log : false
		});

		this.helpers = new DatabaseHelpers(this);
		this.history = new DatabaseHistory(this);
		this.maps = new DatabaseMaps(this);
		this.views = new DatabaseViews(this);
		this.markers = new DatabaseMarkers(this);
		this.lines = new DatabaseLines(this);
		this.types = new DatabaseTypes(this);
		this.meta = new DatabaseMeta(this);
		this.search = new DatabaseSearch(this);
		this.routes = new DatabaseRoutes(this);
		this.migrations = new DatabaseMigrations(this);

		this.history.afterInit();
		this.maps.afterInit();
		this.markers.afterInit();
		this.views.afterInit();
		this.lines.afterInit();
		this.types.afterInit();
	}

	async connect(force?: boolean): Promise<void> {
		await this._conn.authenticate();
		await this.migrations._runMigrationsBeforeSync();
		await this._conn.sync({ force: !!force });
		await this.migrations._runMigrationsAfterSync();

		await this.routes.afterConnect();
	}
}