import { Model, DataTypes, type InferAttributes, type CreationOptional, type ForeignKey, type InferCreationAttributes, type Optional } from "sequelize";
import DatabaseBackend from "./database-backend.js";
import type { HistoryEntryAction, HistoryEntryObject, HistoryEntryType, ID, MapData, PagedResults, PagingInput } from "facilmap-types";
import { createModel, findAllStreamed, getDefaultIdType, getJsonType, makeNotNullForeignKey } from "./utils.js";
import { omit } from "lodash-es";
import type { RawHistoryEntry, RawHistoryEntryMapData } from "../utils/permissions.js";

interface HistoryModel extends Model<InferAttributes<HistoryModel>, InferCreationAttributes<HistoryModel>> {
	id: CreationOptional<ID>;
	time: CreationOptional<Date>;
	type: HistoryEntryType;
	action: HistoryEntryAction;
	objectId: ID | null;
	objectBefore: HistoryEntryObject<Exclude<HistoryEntryType, "Map">> | RawHistoryEntryMapData | null;
	objectAfter: HistoryEntryObject<Exclude<HistoryEntryType, "Map">> | RawHistoryEntryMapData | null;
	mapId: ForeignKey<MapData["id"]>;
}

export default class DatabaseHistoryBackend {

	HistoryModel = createModel<HistoryModel>();

	protected backend: DatabaseBackend;

	constructor(backend: DatabaseBackend) {
		this.backend = backend;

		this.HistoryModel.init({
			id: getDefaultIdType(),
			time: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
			type: { type: DataTypes.ENUM("Marker", "Line", "View", "Type", "Map"), allowNull: false },
			action: { type: DataTypes.ENUM("create", "update", "delete"), allowNull: false },
			objectId: { type: DataTypes.INTEGER(), allowNull: true }, // Is null when type is map
			objectBefore: getJsonType("objectBefore", { allowNull: true }),
			objectAfter: getJsonType("objectAfter", { allowNull: true })
		}, {
			sequelize: this.backend._conn,
			modelName: "History",
			indexes: [
				{ fields: [ "type", "objectId" ] }
			],
			freezeTableName: true // Do not call it Histories
		});
	}


	afterInit(): void {
		this.backend.maps.MapModel.hasMany(this.HistoryModel, makeNotNullForeignKey("History", "mapId"));
		this.HistoryModel.belongsTo(this.backend.maps.MapModel, makeNotNullForeignKey("map", "mapId"));
	}


	protected prepareHistoryEntry(historyEntry: HistoryModel): RawHistoryEntry {
		const data = historyEntry.toJSON();
		return {
			...data,
			time: data.time.toISOString()
		} as RawHistoryEntry;
	}


	async addHistoryEntry(mapId: ID, data: Optional<Omit<RawHistoryEntry, "mapId">, "id" | "time">): Promise<RawHistoryEntry> {
		return this.prepareHistoryEntry(await this.HistoryModel.create({
			...omit(data, ["time"]),
			...data.time ? { time: new Date(data.time) } : {},
			mapId
		}));
	}


	async updateHistoryEntry(mapId: ID, historyEntryId: ID, data: Partial<Omit<RawHistoryEntry, "mapId" | "id">>): Promise<void> {
		await this.HistoryModel.update({
			...omit(data, ["time"]),
			...data.time ? { time: new Date(data.time) } : {}
		}, { where: { id: historyEntryId, mapId } });
	}


	async getPagedHistory(mapId: ID, types: HistoryEntryType[] | undefined, paging: PagingInput): Promise<PagedResults<RawHistoryEntry>> {
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
			results: rows.map((row) => this.prepareHistoryEntry(row)),
			totalLength: count
		};
	}


	async* getHistory(mapId: ID, types?: HistoryEntryType[]): AsyncIterable<RawHistoryEntry> {
		for await (const obj of findAllStreamed(this.HistoryModel, {
			order: [[ "time", "DESC" ]],
			where: {
				...types ? { type: types } : {},
				mapId
			}
		})) {
			yield this.prepareHistoryEntry(obj);
		}
	}


	async getHistoryEntry(mapId: ID, entryId: ID, options?: { notFound404?: boolean }): Promise<RawHistoryEntry | undefined> {
		const entry = await this.HistoryModel.findOne({
			where: { id: entryId, mapId }
		});
		return entry ? this.prepareHistoryEntry(entry) : undefined;
	}


	async clearHistory(mapId: ID): Promise<void> {
		await this.HistoryModel.destroy({ where: { mapId } });
	}

}
