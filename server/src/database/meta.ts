import { DataTypes, Model } from "sequelize";
import Database from "./database.js";

function createMetaModel() {
	return class MetaModel extends Model {
		declare key: string;
		declare value: string;
	};
}

export default class DatabaseMeta {

	MetaModel = createMetaModel();

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
