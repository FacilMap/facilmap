import { type CreationOptional, DataTypes, type ForeignKey, type InferAttributes, type InferCreationAttributes, Model } from "sequelize";
import type { CRU, ID, Latitude, Longitude, MapId, View } from "facilmap-types";
import Database from "./database.js";
import { createModel, getDefaultIdType, getLatType, getLonType, makeNotNullForeignKey } from "./helpers.js";
import type { MapModel } from "./map.js";
import { asyncIteratorToArray } from "../utils/streams.js";
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

	_db: Database;

	constructor(database: Database) {
		this._db = database;

		this.ViewModel.init({
			id: getDefaultIdType(),
			name : { type: DataTypes.TEXT, allowNull: false },
			idx: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			baseLayer : { type: DataTypes.TEXT, allowNull: false },
			layers : {
				type: DataTypes.TEXT,
				allowNull: false,
				get: function(this: ViewModel) {
					const layers = this.getDataValue("layers") as any as string; // https://github.com/sequelize/sequelize/issues/11558
					return layers == null ? [] : JSON.parse(layers);
				},
				set: function(this: ViewModel, v) {
					this.setDataValue("layers", JSON.stringify(v) as any);
				}
			},
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

	getViews(mapId: MapId): AsyncIterable<View> {
		return this._db.helpers._getMapObjects<View>("View", mapId);
	}

	getView(mapId: MapId, viewId: ID): Promise<View> {
		return this._db.helpers._getMapObject<View>("View", mapId, viewId);
	}

	async _freeViewIdx(mapId: MapId, viewId: ID | undefined, newIdx: number | undefined): Promise<number> {
		const existingViews = await asyncIteratorToArray(this.getViews(mapId));

		const resolvedNewIdx = newIdx ?? (existingViews.length > 0 ? existingViews[existingViews.length - 1].idx + 1 : 0);

		const newIndexes = insertIdx(existingViews, viewId, resolvedNewIdx).reverse();

		for (const obj of newIndexes) {
			if ((viewId == null || obj.id !== viewId) && obj.oldIdx !== obj.newIdx) {
				const newData = await this._db.helpers._updateMapObject<View>("View", mapId, obj.id, { idx: obj.newIdx }, true);
				this._db.emit("view", mapId, newData);
			}
		}

		return resolvedNewIdx;
	}

	async createView(mapId: MapId, data: View<CRU.CREATE_VALIDATED>): Promise<View> {
		const idx = await this._freeViewIdx(mapId, undefined, data.idx);

		const newData = await this._db.helpers._createMapObject<View>("View", mapId, {
			...data,
			idx
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

	async updateView(mapId: MapId, viewId: ID, data: View<CRU.UPDATE_VALIDATED>): Promise<View> {
		if (data.idx != null) {
			await this._freeViewIdx(mapId, viewId, data.idx);
		}

		const newData = await this._db.helpers._updateMapObject<View>("View", mapId, viewId, data);

		this._db.emit("view", mapId, newData);
		return newData;
	}

	async deleteView(mapId: MapId, viewId: ID): Promise<View> {
		const data = await this._db.helpers._deleteMapObject<View>("View", mapId, viewId);

		this._db.emit("deleteView", mapId, { id: data.id });
		return data;
	}
}