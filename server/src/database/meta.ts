import { DataTypes, type InferAttributes, type InferCreationAttributes, Model } from "sequelize";
import Database from "./database.js";
import { createModel } from "./helpers.js";

interface MetaModel extends Model<InferAttributes<MetaModel>, InferCreationAttributes<MetaModel>> {
	key: string;
	value: string;
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

	async getMeta(key: string): Promise<string | undefined> {
		const entry = await this.MetaModel.findOne({ where: { key } });
		return entry?.value ?? undefined;
	}

	async setMeta(key: string, value: string): Promise<void> {
		await this.MetaModel.upsert({key, value});
	}

}
