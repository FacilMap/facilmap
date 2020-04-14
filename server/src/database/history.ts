import { clone, promiseAuto } from "../utils/utils";
import { Model, DataTypes } from "sequelize";
import Database from "./database";
import { HistoryEntry, HistoryEntryAction, HistoryEntryCreate, HistoryEntryType, ID, PadId } from "facilmap-types";

function createHistoryModel() {
	return class History extends Model {
		id!: ID;
		time!: Date;
		type!: HistoryEntryType;
		action!: HistoryEntryAction;
		objectId!: ID;
		objectBefore!: string | null;
		objectAfter!: string | null;
		padId!: PadId;
	};
}

type HistoryModel = InstanceType<ReturnType<typeof createHistoryModel>>;

export default class DatabaseHistory {

	HISTORY_ENTRIES = 50;

	HistoryModel = createHistoryModel();

	_db: Database;

	constructor(database: Database) {
		this._db = database;

		this.HistoryModel.init({
			time: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
			type: { type: DataTypes.ENUM("Marker", "Line", "View", "Type", "Pad"), allowNull: false },
			action: { type: DataTypes.ENUM("create", "update", "delete"), allowNull: false },
			objectId: { type: DataTypes.INTEGER(), allowNull: true }, // Is null when type is pad
			objectBefore: {
				type: DataTypes.TEXT,
				allowNull: true,
				get(this: HistoryModel) {
					var obj = this.getDataValue("objectBefore");
					return obj == null ? null : JSON.parse(obj);
				},
				set(this: HistoryModel, v) {
					this.setDataValue("objectBefore", v == null ? null : JSON.stringify(v));
				}
			},
			objectAfter: {
				type: DataTypes.TEXT,
				allowNull: true,
				get: function(this: HistoryModel) {
					var obj = this.getDataValue("objectAfter");
					return obj == null ? null : JSON.parse(obj);
				},
				set: function(this: HistoryModel, v) {
					this.setDataValue("objectAfter", v == null ? null : JSON.stringify(v));
				}
			}
		}, {
			sequelize: this._db._conn,
			freezeTableName: true // Do not call it Histories
		});
	}


	afterInit() {
		this._db.pad.PadModel.hasMany(this.HistoryModel, this._db.helpers._makeNotNullForeignKey("History", "padId"));
		this.HistoryModel.belongsTo(this._db.pad.PadModel, this._db.helpers._makeNotNullForeignKey("pad", "padId"));
		this.HistoryModel.findOne()
	}


	addHistoryEntry(padId: ID, data: HistoryEntryCreate) {
		return promiseAuto({
			oldEntryIds: async () => {
				const ids = await this.HistoryModel.findAll({
					where: { padId: padId },
					order: [[ "time", "DESC" ]],
					offset: this.HISTORY_ENTRIES-1,
					attributes: [ "id" ]
				});
				return ids.map(it => it.id);
			},
			destroyOld: async (oldEntryIds: ID[]) => {
				if(oldEntryIds && oldEntryIds.length > 0) {
					return this._db._conn.model("History").destroy({ where: { padId: padId, id: oldEntryIds } });
				}
			},
			addEntry: (oldEntryIds: ID[]) => {
				var dataClone = clone(data);
				if(data.type != "Pad") {
					if(dataClone.objectBefore) {
						delete dataClone.objectBefore.id;
						delete dataClone.objectBefore.padId;
					}
					if(dataClone.objectAfter) {
						delete dataClone.objectAfter.id;
						delete dataClone.objectAfter.padId;
					}
				}

				return this.helpers._createPadObject("History", padId, dataClone);
			}
		}).then(res => {
			this._db.emit("addHistoryEntry", padId, res.addEntry);

			return res.addEntry;
		});
	}


	getHistory(padId: PadId, types?: HistoryEntryType[]): HistoryEntry {
		let query = { order: [[ "time", "DESC" ]] };
		if(types)
			query.where = {type: types};
		return this.helpers._getPadObjects("History", padId, query);
	}


	getHistoryEntry(padId, entryId) {
		return this._getPadObject("History", padId, entryId);
	}


	revertHistoryEntry(padId, id) {
		return this.getHistoryEntry(padId, id).then((entry) => {
			if(entry.type == "Pad")
				return this.updatePadData(padId, entry.objectBefore);

			return promiseAuto({
				existsNow: () => {
					return this._padObjectExists(entry.type, padId, entry.objectId);
				},

				restore: (existsNow) => {
					var objectBefore = JSON.parse(JSON.stringify(entry.objectBefore));

					if(entry.action == "create")
						return existsNow && this["delete" + entry.type].call(this, padId, entry.objectId, objectBefore);
					else if(existsNow)
						return this["update" + entry.type].call(this, padId, entry.objectId, objectBefore);
					else {
						return this["create" + entry.type].call(this, padId, objectBefore).then((newObj) => {
							return this._db._conn.model("History").update({ objectId: newObj.id }, { where: { padId: padId, type: entry.type, objectId: entry.objectId } }).then(() => {
								this.emit("historyChange", padId);
							});
						});
					}
				}
			}).then(res => null);
		});
	}


	async clearHistory(padId: PadId) {
		await this.HistoryModel.destroy({ where: { padId: padId } });
	}

}
