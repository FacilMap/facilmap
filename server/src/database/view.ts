import { type CreationOptional, DataTypes, type ForeignKey, type InferAttributes, type InferCreationAttributes, Model } from "sequelize";
import type { CRU, ID, Latitude, Longitude, PadId, View } from "facilmap-types";
import Database from "./database.js";
import { createModel, getDefaultIdType, getLatType, getLonType, makeNotNullForeignKey } from "./helpers.js";
import type { PadModel } from "./pad.js";
import { asyncIteratorToArray } from "../utils/streams.js";
import { insertIdx } from "facilmap-utils";

export interface ViewModel extends Model<InferAttributes<ViewModel>, InferCreationAttributes<ViewModel>> {
	id: CreationOptional<ID>;
	padId: ForeignKey<PadModel["id"]>;
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
		this.ViewModel.belongsTo(this._db.pads.PadModel, makeNotNullForeignKey("pad", "padId"));
		this._db.pads.PadModel.hasMany(this.ViewModel, { foreignKey: "padId" });
	}

	getViews(padId: PadId): AsyncIterable<View> {
		return this._db.helpers._getPadObjects<View>("View", padId);
	}

	async _freeViewIdx(padId: PadId, viewId: ID | undefined, newIdx: number | undefined): Promise<number> {
		const existingViews = await asyncIteratorToArray(this.getViews(padId));

		const resolvedNewIdx = newIdx ?? (existingViews.length > 0 ? existingViews[existingViews.length - 1].idx + 1 : 0);

		const newIndexes = insertIdx(existingViews, viewId, resolvedNewIdx).reverse();

		for (const obj of newIndexes) {
			if ((viewId == null || obj.id !== viewId) && obj.oldIdx !== obj.newIdx) {
				const newData = await this._db.helpers._updatePadObject<View>("View", padId, obj.id, { idx: obj.newIdx }, true);
				this._db.emit("view", padId, newData);
			}
		}

		return resolvedNewIdx;
	}

	async createView(padId: PadId, data: View<CRU.CREATE_VALIDATED>): Promise<View> {
		const idx = await this._freeViewIdx(padId, undefined, data.idx);

		const newData = await this._db.helpers._createPadObject<View>("View", padId, {
			...data,
			idx
		});

		await this._db.history.addHistoryEntry(padId, {
			type: "View",
			action: "create",
			objectId: newData.id,
			objectAfter: newData
		});

		this._db.emit("view", padId, newData);
		return newData;
	}

	async updateView(padId: PadId, viewId: ID, data: Omit<View<CRU.UPDATE_VALIDATED>, "id">): Promise<View> {
		if (data.idx != null) {
			await this._freeViewIdx(padId, viewId, data.idx);
		}

		const newData = await this._db.helpers._updatePadObject<View>("View", padId, viewId, data);

		this._db.emit("view", padId, newData);
		return newData;
	}

	async deleteView(padId: PadId, viewId: ID): Promise<View> {
		const data = await this._db.helpers._deletePadObject<View>("View", padId, viewId);

		this._db.emit("deleteView", padId, { id: data.id });
		return data;
	}
}