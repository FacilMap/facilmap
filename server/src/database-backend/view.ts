import { type CreationOptional, DataTypes, type ForeignKey, type InferAttributes, type InferCreationAttributes, Model } from "sequelize";
import type { CRU, ID, Latitude, Longitude, View } from "facilmap-types";
import DatabaseBackend from "./database.js";
import { createModel, getDefaultIdType, getJsonType, getLatType, getLonType, makeNotNullForeignKey } from "./helpers.js";
import type { MapModel } from "./map.js";
import { iterableToArray } from "../utils/streams.js";
import { insertIdx } from "facilmap-utils";

export interface ViewModel extends Model<InferAttributes<ViewModel>, InferCreationAttributes<ViewModel>> {
	id: CreationOptional<ID>;
	mapId: ForeignKey<MapModel["id"]>;
	name: string;
	idx: number;
	baseLayer: string;
	layers: string[];
	top: Latitude;
	bottom: Latitude;
	left: Longitude;
	right: Longitude;
	filter: string | null;
	toJSON: () => View;
}

export default class DatabaseViews {

	ViewModel = createModel<ViewModel>();

	_db: DatabaseBackend;

	constructor(database: DatabaseBackend) {
		this._db = database;

		this.ViewModel.init({
			id: getDefaultIdType(),
			name : { type: DataTypes.TEXT, allowNull: false },
			idx: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			baseLayer : { type: DataTypes.TEXT, allowNull: false },
			layers : getJsonType("layers", { allowNull: false, get: (v) => v ?? [] }),
			top : getLatType(),
			bottom : getLatType(),
			left : getLonType(),
			right : getLonType(),
			filter: { type: DataTypes.TEXT, allowNull: true }
		}, {
			sequelize: this._db._conn,
			modelName: "View"
		});
	}

	afterInit(): void {
		this.ViewModel.belongsTo(this._db.maps.MapModel, makeNotNullForeignKey("map", "mapId"));
		this._db.maps.MapModel.hasMany(this.ViewModel, { foreignKey: "mapId" });
	}

	getViews(mapId: ID): AsyncIterable<View> {
		return this._db.helpers._getMapObjects<View>("View", mapId);
	}

	getView(mapId: ID, viewId: ID, options?: { notFound404?: boolean }): Promise<View> {
		return this._db.helpers._getMapObject<View>("View", mapId, viewId, options);
	}

	async _freeViewIdx(mapId: ID, viewId: ID | undefined, newIdx: number | undefined): Promise<number> {
		const existingViews = await iterableToArray(this.getViews(mapId));

		const resolvedNewIdx = newIdx ?? (existingViews.length > 0 ? existingViews[existingViews.length - 1].idx + 1 : 0);

		const newIndexes = insertIdx(existingViews, viewId, resolvedNewIdx).reverse();

		for (const obj of newIndexes) {
			if ((viewId == null || obj.id !== viewId) && obj.oldIdx !== obj.newIdx) {
				const newData = await this._db.helpers._updateMapObject<View>("View", mapId, obj.id, { idx: obj.newIdx }, { noHistory: true });
				this._db.emit("view", mapId, newData);
			}
		}

		return resolvedNewIdx;
	}

	async createView(mapId: ID, data: View<CRU.CREATE_VALIDATED>, options?: { id?: ID }): Promise<View> {
		const idx = await this._freeViewIdx(mapId, undefined, data.idx);

		const newData = await this._db.helpers._createMapObject<View>("View", mapId, {
			...data,
			idx,
			...options?.id ? { id: options.id } : {}
		});

		await this._db.history.addHistoryEntry(mapId, {
			type: "View",
			action: "create",
			objectId: newData.id,
			objectAfter: newData
		});

		this._db.emit("view", mapId, newData);
		return newData;
	}

	async updateView(mapId: ID, viewId: ID, data: View<CRU.UPDATE_VALIDATED>, options?: { notFound404?: boolean }): Promise<View> {
		if (data.idx != null) {
			await this._freeViewIdx(mapId, viewId, data.idx);
		}

		const newData = await this._db.helpers._updateMapObject<View>("View", mapId, viewId, data, options);

		this._db.emit("view", mapId, newData);
		return newData;
	}

	async deleteView(mapId: ID, viewId: ID, options?: { notFound404?: boolean }): Promise<View> {
		const data = await this._db.helpers._deleteMapObject<View>("View", mapId, viewId, options);

		this._db.emit("deleteView", mapId, { id: data.id });
		return data;
	}
}