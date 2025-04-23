import { DataTypes, type InferAttributes, type InferCreationAttributes, Model } from "sequelize";
import DatabaseBackend from "./database-backend.js";
import { createModel } from "./utils.js";

interface MetaModel extends Model<InferAttributes<MetaModel>, InferCreationAttributes<MetaModel>> {
	key: string;
	value: string;
}

export interface MetaProperties {
	dropdownKeysMigrated: "1";
	hasElevation: "1" | "2";
	hasLegendOption: "1";
	hasBboxes: "1";
	untitledMigrationCompleted: "1";
	fieldsNullMigrationCompleted: "1";
	extraInfoNullMigrationCompleted: "1";
	typesIdxMigrationCompleted: "1";
	viewsIdxMigrationCompleted: "1";
	fieldIconsMigrationCompleted: "1";
	historyPadMigrationCompleted: "1";
	mapIdMigrationCompleted: "1" | "2" | "3";
}

/** In a newly created database, the meta properties are set to this. */
const INITIAL_META: { [K in keyof MetaProperties]: MetaProperties[K] } = {
	dropdownKeysMigrated: "1",
	hasElevation: "2",
	hasLegendOption: "1",
	hasBboxes: "1",
	untitledMigrationCompleted: "1",
	fieldsNullMigrationCompleted: "1",
	extraInfoNullMigrationCompleted: "1",
	typesIdxMigrationCompleted: "1",
	viewsIdxMigrationCompleted: "1",
	fieldIconsMigrationCompleted: "1",
	historyPadMigrationCompleted: "1",
	mapIdMigrationCompleted: "3"
};

export default class DatabaseMetaBackend {

	MetaModel = createModel<MetaModel>();

	protected backend: DatabaseBackend;

	constructor(backend: DatabaseBackend) {
		this.backend = backend;

		this.MetaModel.init({
			key: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
			value: { type: DataTypes.TEXT, allowNull: false }
		}, {
			sequelize: this.backend._conn,
			modelName: "Meta"
		});
	}

	async getMeta<K extends keyof MetaProperties>(key: K): Promise<MetaProperties[K] | undefined> {
		const entry = await this.MetaModel.findOne({ where: { key } });
		return entry?.value ?? undefined as any;
	}

	async setMeta<K extends keyof MetaProperties>(key: K, value: MetaProperties[K]): Promise<void> {
		await this.MetaModel.upsert({key, value});
	}

	/** Initializes the contents of the Meta table for a newly created database. */
	async initializeMeta(): Promise<void> {
		await this.MetaModel.bulkCreate(Object.entries(INITIAL_META).map(([key, value]) => ({ key, value })));
	}

}
