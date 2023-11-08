import { Sequelize } from "sequelize";
import debug from "debug";
import DatabaseHelpers from "./helpers.js";
import DatabaseHistory from "./history.js";
import type { DbConfig } from "../config.js";
import DatabasePads from "./pad.js";
import DatabaseViews from "./view.js";
import DatabaseLines from "./line.js";
import DatabaseTypes from "./type.js";
import DatabaseMarkers from "./marker.js";
import DatabaseMeta from "./meta.js";
import DatabaseSearch from "./search.js";
import DatabaseRoutes from "./route.js";
import DatabaseMigrations from "./migrations.js";
import { TypedEventEmitter } from "../utils/events.js";
import type { HistoryEntry, ID, Line, Marker, ObjectWithId, PadData, PadId, TrackPoint, Type, View } from "facilmap-types";

export interface DatabaseEvents {
	addHistoryEntry: [padId: PadId, newEntry: HistoryEntry];
	historyChange: [padId: PadId];

	line: [padId: PadId, newLine: Line];
	linePoints: [padId: PadId, lineId: ID, points: TrackPoint[]];
	deleteLine: [padId: PadId, data: ObjectWithId];

	marker: [padId: PadId, newMarker: Marker];
	deleteMarker: [padId: PadId, data: ObjectWithId];

	padData: [padId: PadId, padData: PadData];
	deletePad: [padId: PadId];

	type: [padId: PadId, newType: Type];
	deleteType: [padId: PadId, data: ObjectWithId];

	view: [padId: PadId, newView: View];
	deleteView: [padId: PadId, data: ObjectWithId];
}

export default class Database extends TypedEventEmitter<DatabaseEvents> {

	_conn: Sequelize;
	helpers: DatabaseHelpers;
	history: DatabaseHistory;
	pads: DatabasePads;
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
		this.pads = new DatabasePads(this);
		this.views = new DatabaseViews(this);
		this.markers = new DatabaseMarkers(this);
		this.lines = new DatabaseLines(this);
		this.types = new DatabaseTypes(this);
		this.meta = new DatabaseMeta(this);
		this.search = new DatabaseSearch(this);
		this.routes = new DatabaseRoutes(this);
		this.migrations = new DatabaseMigrations(this);

		this.history.afterInit();
		this.pads.afterInit();
		this.markers.afterInit();
		this.views.afterInit();
		this.lines.afterInit();
		this.types.afterInit();
	}

	async connect(force?: boolean): Promise<void> {
		await this._conn.authenticate();
		await this._conn.sync({ force: !!force });
		await this.migrations._runMigrations()
	}
}