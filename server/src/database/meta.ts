import { DataTypes, Model } from "sequelize";
import Database from "./database";

interface Meta {
	key: string;
	value: string;
}

function createMetaModel() {
	return class MetaModel extends Model {
		key!: string;
		value!: string;
	};
}

type MetaModel = InstanceType<ReturnType<typeof createMetaModel>>;

export default class DatabaseMeta {

	MetaModel = createMetaModel();

	_db: Database;

	constructor(database: Database) {
		this._db = database;

		this.MetaModel.init({
			key: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
			value: { type: DataTypes.TEXT, allowNull: false }
		}, {
			sequelize: this._db._conn
		});
	}

	async getMeta(key: string) {
		const entry = await this.MetaModel.findOne({ where: { key } });
		return entry && entry.value;
	}

	setMeta(key: string, value: string) {
		return this.MetaModel.upsert({key, value});
	}

}
