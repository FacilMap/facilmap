import { Sequelize } from "sequelize";
import debug from "debug";
import DatabaseHelpers from "./helpers";
import DatabaseHistory from "./history";
import { DbConfig } from "../config";
import DatabasePads from "./pad";
import DatabaseViews from "./view";
import DatabaseLines from "./line";
import DatabaseTypes from "./type";
import DatabaseMarkers from "./marker";
import DatabaseMeta from "./meta";
import DatabaseSearch from "./search";
import DatabaseRoutes from "./route";
import DatabaseMigrations from "./migrations";
import { TypedEventEmitter } from "../utils/events";
import { HistoryEntry, ID, Line, Marker, ObjectWithId, PadData, PadId, TrackPoint, Type, View } from "facilmap-types";

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

module.exports = Database;