import { Sequelize } from "sequelize";
import debug from "debug";
import DatabaseHistoryBackend from "./history.js";
import type { DbConfig } from "../config.js";
import DatabaseMapsBackend from "./map.js";
import DatabaseViewsBackend from "./view.js";
import DatabaseLinesBackend from "./line.js";
import DatabaseTypesBackend from "./type.js";
import DatabaseMarkersBackend from "./marker.js";
import DatabaseMetaBackend from "./meta.js";
import DatabaseRoutesBackend from "./route.js";
import DatabaseBackendMigrations from "./migrations.js";

export default class DatabaseBackend {

	_conn: Sequelize;
	history: DatabaseHistoryBackend;
	maps: DatabaseMapsBackend;
	views: DatabaseViewsBackend;
	markers: DatabaseMarkersBackend;
	lines: DatabaseLinesBackend;
	types: DatabaseTypesBackend;
	meta: DatabaseMetaBackend;
	routes: DatabaseRoutesBackend;
	migrations: DatabaseBackendMigrations;

	constructor(dbConfig: DbConfig) {
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

		this.history = new DatabaseHistoryBackend(this);
		this.maps = new DatabaseMapsBackend(this);
		this.views = new DatabaseViewsBackend(this);
		this.markers = new DatabaseMarkersBackend(this);
		this.lines = new DatabaseLinesBackend(this);
		this.types = new DatabaseTypesBackend(this);
		this.meta = new DatabaseMetaBackend(this);
		this.routes = new DatabaseRoutesBackend(this);
		this.migrations = new DatabaseBackendMigrations(this);

		this.history.afterInit();
		this.maps.afterInit();
		this.markers.afterInit();
		this.views.afterInit();
		this.lines.afterInit();
		this.types.afterInit();
	}

	async connect(): Promise<void> {
		await this._conn.authenticate();
		const isNewDatabase = (await this._conn.getQueryInterface().showAllTables()).length === 0;
		await this.migrations._runMigrationsBeforeSync();
		await this._conn.sync();
		if (isNewDatabase) {
			await this.meta.initializeMeta();
		}
		await this.migrations._runMigrationsAfterSync1();

		this.maps.afterMigration1();
		await this._conn.sync();
		await this.migrations._runMigrationsAfterSync2();

		// Delete all route points, clients will have to reconnect and recalculate their routes anyways
		await this.routes.truncateRoutePoints();
	}
}