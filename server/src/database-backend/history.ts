import { Model, DataTypes, type InferAttributes, type CreationOptional, type ForeignKey, type InferCreationAttributes } from "sequelize";
import DatabaseBackend from "./database.js";
import type { HistoryEntry, HistoryEntryAction, HistoryEntryCreate, HistoryEntryObject, HistoryEntryType, ID, MapData, PagedResults, PagingInput } from "facilmap-types";
import { createModel, getDefaultIdType, getJsonType, makeNotNullForeignKey } from "./helpers.js";
import { cloneDeep } from "lodash-es";
import { getI18n } from "../i18n.js";

interface HistoryModel extends Model<InferAttributes<HistoryModel>, InferCreationAttributes<HistoryModel>> {
	id: CreationOptional<ID>;
	time: Date;
	type: HistoryEntryType;
	action: HistoryEntryAction;
	objectId: ID;
	objectBefore: HistoryEntryObject<HistoryEntryType> | null;
	objectAfter: HistoryEntryObject<HistoryEntryType> | null;
	mapId: ForeignKey<MapData["id"]>;
	toJSON: () => HistoryEntry;
}

export default class DatabaseHistory {

	HistoryModel = createModel<HistoryModel>();

	_db: DatabaseBackend;

	constructor(database: DatabaseBackend) {
		this._db = database;

		this.HistoryModel.init({
			id: getDefaultIdType(),
			time: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
			type: { type: DataTypes.ENUM("Marker", "Line", "View", "Type", "Map"), allowNull: false },
			action: { type: DataTypes.ENUM("create", "update", "delete"), allowNull: false },
			objectId: { type: DataTypes.INTEGER(), allowNull: true }, // Is null when type is map
			objectBefore: getJsonType("objectBefore", { allowNull: true }),
			objectAfter: getJsonType("objectAfter", { allowNull: true })
		}, {
			sequelize: this._db._conn,
			modelName: "History",
			indexes: [
				{ fields: [ "type", "objectId" ] }
			],
			freezeTableName: true // Do not call it Histories
		});
	}


	afterInit(): void {
		this._db.maps.MapModel.hasMany(this.HistoryModel, makeNotNullForeignKey("History", "mapId"));
		this.HistoryModel.belongsTo(this._db.maps.MapModel, makeNotNullForeignKey("map", "mapId"));
	}


	async addHistoryEntry(mapId: ID, data: HistoryEntryCreate): Promise<HistoryEntry> {
		const dataClone = cloneDeep(data);
		if(dataClone.objectBefore) {
			delete (dataClone.objectBefore as any).id;
			delete (dataClone.objectBefore as any).mapId;
			delete (dataClone.objectBefore as any).defaultView;
		}
		if(dataClone.objectAfter) {
			delete (dataClone.objectAfter as any).id;
			delete (dataClone.objectAfter as any).mapId;
			delete (dataClone.objectAfter as any).defaultView;
		}

		const newEntry = await this._db.helpers._createMapObject<HistoryEntry>("History", mapId, dataClone);

		this._db.emit("historyEntry", mapId, newEntry);

		return newEntry;
	}


	async getPagedHistory(mapId: ID, types: HistoryEntryType[] | undefined, paging: PagingInput): Promise<PagedResults<HistoryEntry>> {
		const { count, rows } = await this.HistoryModel.findAndCountAll({
			where: {
				mapId: mapId,
				...types ? {
					where: { type: types }
				} : {}
			},
			order: [[ "time", "DESC" ]],
			offset: paging?.start ?? 0,
			...paging?.limit != null ? {
				limit: paging.limit
			} : {}
		});

		return {
			results: rows.map((row) => row.toJSON()),
			totalLength: count
		};
	}


	getHistory(mapId: ID, types?: HistoryEntryType[]): AsyncIterable<HistoryEntry> {
		return this._db.helpers._getMapObjects<HistoryEntry>("History", mapId, {
			order: [[ "time", "DESC" ]],
			...types ? {
				where: { type: types }
			} : {}
		});
	}


	async getHistoryEntry(mapId: ID, entryId: ID, options?: { notFound404?: boolean }): Promise<HistoryEntry> {
		return await this._db.helpers._getMapObject<HistoryEntry>("History", mapId, entryId, options);
	}


	async revertHistoryEntry(mapId: ID, id: ID): Promise<void> {
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
			switch (entry.type) {
				case "Marker":
					await this._db.markers.createMarker(mapId, entry.objectBefore, { id: entry.objectId });
					break;

				case "Line":
					await this._db.lines.createLine(mapId, entry.objectBefore, { id: entry.objectId });
					break;

				case "View":
					await this._db.views.createView(mapId, entry.objectBefore, { id: entry.objectId });
					break;

				case "Type":
					await this._db.types.createType(mapId, entry.objectBefore, { id: entry.objectId });
					break;
			}
		}
	}


	async clearHistory(mapId: ID): Promise<void> {
		await this.HistoryModel.destroy({ where: { mapId } });
	}

}
