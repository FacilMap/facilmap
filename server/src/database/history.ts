import { Model, DataTypes, type FindOptions, type InferAttributes, type CreationOptional, type ForeignKey, type InferCreationAttributes } from "sequelize";
import Database from "./database.js";
import type { HistoryEntry, HistoryEntryAction, HistoryEntryCreate, HistoryEntryType, ID, MapData, MapId } from "facilmap-types";
import { createModel, getDefaultIdType, makeNotNullForeignKey } from "./helpers.js";
import { cloneDeep } from "lodash-es";
import { getI18n } from "../i18n.js";

interface HistoryModel extends Model<InferAttributes<HistoryModel>, InferCreationAttributes<HistoryModel>> {
	id: CreationOptional<ID>;
	time: Date;
	type: HistoryEntryType;
	action: HistoryEntryAction;
	objectId: ID;
	objectBefore: string | null;
	objectAfter: string | null;
	padId: ForeignKey<MapData["id"]>;
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
			type: { type: DataTypes.ENUM("Marker", "Line", "View", "Type", "Map"), allowNull: false },
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
		this._db.maps.MapModel.hasMany(this.HistoryModel, makeNotNullForeignKey("History", "padId"));
		this.HistoryModel.belongsTo(this._db.maps.MapModel, makeNotNullForeignKey("pad", "padId"));
	}


	async addHistoryEntry(mapId: MapId, data: HistoryEntryCreate): Promise<HistoryEntry> {
		const oldEntryIds = (await this.HistoryModel.findAll({
			where: { padId: mapId },
			order: [[ "time", "DESC" ]],
			offset: this.HISTORY_ENTRIES-1,
			attributes: [ "id" ]
		})).map(it => it.id);

		const dataClone = cloneDeep(data);
		if(data.type != "Map") {
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
			this._db.helpers._createMapObject<HistoryEntry>("History", mapId, dataClone),
			oldEntryIds.length > 0 ? this.HistoryModel.destroy({ where: { padId: mapId, id: oldEntryIds } }) : undefined
		]);

		this._db.emit("addHistoryEntry", mapId, newEntry);

		return newEntry;
	}


	getHistory(mapId: MapId, types?: HistoryEntryType[]): AsyncIterable<HistoryEntry> {
		const query: FindOptions = { order: [[ "time", "DESC" ]] };
		if(types)
			query.where = {type: types};
		return this._db.helpers._getMapObjects<HistoryEntry>("History", mapId, query);
	}


	async getHistoryEntry(mapId: MapId, entryId: ID): Promise<HistoryEntry> {
		return await this._db.helpers._getMapObject<HistoryEntry>("History", mapId, entryId);
	}


	async revertHistoryEntry(mapId: MapId, id: ID): Promise<void> {
		const entry = await this.getHistoryEntry(mapId, id);

		if(entry.type == "Map") {
			if (!entry.objectBefore) {
				throw new Error(getI18n().t("database.old-map-data-not-available-error"));
			}
			await this._db.maps.updateMapData(mapId, entry.objectBefore);
			return;
		} else if (!["Marker", "Line", "View", "Type"].includes(entry.type)) {
			throw new Error(getI18n().t("database.unknown-type-error", { type: entry.type }));
		}

		const existsNow = await this._db.helpers._mapObjectExists(entry.type, mapId, entry.objectId);

		if(entry.action == "create") {
			if (!existsNow)
				return;

			switch (entry.type) {
				case "Marker":
					await this._db.markers.deleteMarker(mapId, entry.objectId);
					break;

				case "Line":
					await this._db.lines.deleteLine(mapId, entry.objectId);
					break;

				case "View":
					await this._db.views.deleteView(mapId, entry.objectId);
					break;

				case "Type":
					await this._db.types.deleteType(mapId, entry.objectId);
					break;
			}
		} else if(existsNow) {
			switch (entry.type) {
				case "Marker":
					await this._db.markers.updateMarker(mapId, entry.objectId, entry.objectBefore);
					break;

				case "Line":
					await this._db.lines.updateLine(mapId, entry.objectId, entry.objectBefore);
					break;

				case "View":
					await this._db.views.updateView(mapId, entry.objectId, entry.objectBefore);
					break;

				case "Type":
					await this._db.types.updateType(mapId, entry.objectId, entry.objectBefore);
					break;
			}
		} else {
			let newObj;

			switch (entry.type) {
				case "Marker":
					newObj = await this._db.markers.createMarker(mapId, entry.objectBefore);
					break;

				case "Line":
					newObj = await this._db.lines.createLine(mapId, entry.objectBefore);
					break;

				case "View":
					newObj = await this._db.views.createView(mapId, entry.objectBefore);
					break;

				case "Type":
					newObj = await this._db.types.createType(mapId, entry.objectBefore);
					break;
			}

			await this.HistoryModel.update({ objectId: newObj.id }, { where: { padId: mapId, type: entry.type, objectId: entry.objectId } });
			this._db.emit("historyChange", mapId);
		}
	}


	async clearHistory(mapId: MapId): Promise<void> {
		await this.HistoryModel.destroy({ where: { padId: mapId } });
	}

}
