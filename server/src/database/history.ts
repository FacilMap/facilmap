import { Model, DataTypes, FindOptions, InferAttributes, CreationOptional, ForeignKey, InferCreationAttributes } from "sequelize";
import Database from "./database.js";
import { HistoryEntry, HistoryEntryAction, HistoryEntryCreate, HistoryEntryType, ID, PadData, PadId } from "facilmap-types";
import { createModel, getDefaultIdType, makeNotNullForeignKey } from "./helpers.js";
import { clone } from "lodash-es";

interface HistoryModel extends Model<InferAttributes<HistoryModel>, InferCreationAttributes<HistoryModel>> {
	id: CreationOptional<ID>;
	time: Date;
	type: HistoryEntryType;
	action: HistoryEntryAction;
	objectId: ID;
	objectBefore: string | null;
	objectAfter: string | null;
	padId: ForeignKey<PadData["id"]>;
	toJSON: () => HistoryEntry;
}

export default class DatabaseHistory {

	HISTORY_ENTRIES = 50;

	HistoryModel = createModel<HistoryModel>();

	_db: Database;

	constructor(database: Database) {
		this._db = database;

		this.HistoryModel.init({
			id: getDefaultIdType(),
			time: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
			type: { type: DataTypes.ENUM("Marker", "Line", "View", "Type", "Pad"), allowNull: false },
			action: { type: DataTypes.ENUM("create", "update", "delete"), allowNull: false },
			objectId: { type: DataTypes.INTEGER(), allowNull: true }, // Is null when type is pad
			objectBefore: {
				type: DataTypes.TEXT,
				allowNull: true,
				get(this: HistoryModel) {
					const obj = this.getDataValue("objectBefore");
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
					const obj = this.getDataValue("objectAfter");
					return obj == null ? null : JSON.parse(obj);
				},
				set: function(this: HistoryModel, v) {
					this.setDataValue("objectAfter", v == null ? null : JSON.stringify(v));
				}
			}
		}, {
			sequelize: this._db._conn,
			modelName: "History",
			freezeTableName: true // Do not call it Histories
		});
	}


	afterInit(): void {
		this._db.pads.PadModel.hasMany(this.HistoryModel, makeNotNullForeignKey("History", "padId"));
		this.HistoryModel.belongsTo(this._db.pads.PadModel, makeNotNullForeignKey("pad", "padId"));
	}


	async addHistoryEntry(padId: PadId, data: HistoryEntryCreate): Promise<HistoryEntry> {
		const oldEntryIds = (await this.HistoryModel.findAll({
			where: { padId: padId },
			order: [[ "time", "DESC" ]],
			offset: this.HISTORY_ENTRIES-1,
			attributes: [ "id" ]
		})).map(it => it.id);

		const dataClone = clone(data);
		if(data.type != "Pad") {
			if(dataClone.objectBefore) {
				delete (dataClone.objectBefore as any).id;
				delete (dataClone.objectBefore as any).padId;
			}
			if(dataClone.objectAfter) {
				delete (dataClone.objectAfter as any).id;
				delete (dataClone.objectAfter as any).padId;
			}
		}

		const [newEntry] = await Promise.all([
			this._db.helpers._createPadObject<HistoryEntry>("History", padId, dataClone),
			oldEntryIds.length > 0 ? this.HistoryModel.destroy({ where: { padId: padId, id: oldEntryIds } }) : undefined
		]);

		this._db.emit("addHistoryEntry", padId, newEntry);

		return newEntry;
	}


	getHistory(padId: PadId, types?: HistoryEntryType[]): AsyncGenerator<HistoryEntry, void, never> {
		const query: FindOptions = { order: [[ "time", "DESC" ]] };
		if(types)
			query.where = {type: types};
		return this._db.helpers._getPadObjects<HistoryEntry>("History", padId, query);
	}


	async getHistoryEntry(padId: PadId, entryId: ID): Promise<HistoryEntry> {
		return await this._db.helpers._getPadObject<HistoryEntry>("History", padId, entryId);
	}


	async revertHistoryEntry(padId: PadId, id: ID): Promise<void> {
		const entry = await this.getHistoryEntry(padId, id);

		if(entry.type == "Pad") {
			if (!entry.objectBefore) {
				throw new Error("Old pad data not available.");
			}
			await this._db.pads.updatePadData(padId, entry.objectBefore);
			return;
		} else if (!["Marker", "Line", "View", "Type"].includes(entry.type)) {
			throw new Error(`Unknown type "${entry.type}.`);
		}

		const existsNow = await this._db.helpers._padObjectExists(entry.type, padId, entry.objectId);

		if(entry.action == "create") {
			if (!existsNow)
				return;

			switch (entry.type) {
				case "Marker":
					await this._db.markers.deleteMarker(padId, entry.objectId);
					break;

				case "Line":
					await this._db.lines.deleteLine(padId, entry.objectId);
					break;

				case "View":
					await this._db.views.deleteView(padId, entry.objectId);
					break;

				case "Type":
					await this._db.types.deleteType(padId, entry.objectId);
					break;
			}
		} else if(existsNow) {
			switch (entry.type) {
				case "Marker":
					await this._db.markers.updateMarker(padId, entry.objectId, entry.objectBefore);
					break;

				case "Line":
					await this._db.lines.updateLine(padId, entry.objectId, entry.objectBefore);
					break;

				case "View":
					await this._db.views.updateView(padId, entry.objectId, entry.objectBefore);
					break;

				case "Type":
					await this._db.types.updateType(padId, entry.objectId, entry.objectBefore);
					break;
			}
		} else {
			let newObj;

			switch (entry.type) {
				case "Marker":
					newObj = await this._db.markers.createMarker(padId, entry.objectBefore);
					break;

				case "Line":
					newObj = await this._db.lines.createLine(padId, entry.objectBefore);
					break;

				case "View":
					newObj = await this._db.views.createView(padId, entry.objectBefore);
					break;

				case "Type":
					newObj = await this._db.types.createType(padId, entry.objectBefore);
					break;
			}

			await this.HistoryModel.update({ objectId: newObj.id }, { where: { padId: padId, type: entry.type, objectId: entry.objectId } });
			this._db.emit("historyChange", padId);
		}
	}


	async clearHistory(padId: PadId): Promise<void> {
		await this.HistoryModel.destroy({ where: { padId: padId } });
	}

}
