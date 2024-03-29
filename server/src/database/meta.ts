import { DataTypes, type InferAttributes, type InferCreationAttributes, Model } from "sequelize";
import Database from "./database.js";
import { createModel } from "./helpers.js";

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
}

export default class DatabaseMeta {

	MetaModel = createModel<MetaModel>();

	_db: Database;

	constructor(database: Database) {
		this._db = database;

		this.MetaModel.init({
			key: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
			value: { type: DataTypes.TEXT, allowNull: false }
		}, {
			sequelize: this._db._conn,
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

}
