import { type CreationOptional, DataTypes, type ForeignKey, type InferAttributes, type InferCreationAttributes, Model } from "sequelize";
import type { CRU, ID, Latitude, Longitude, PadId, View } from "facilmap-types";
import Database from "./database.js";
import { createModel, getDefaultIdType, getLatType, getLonType, makeNotNullForeignKey } from "./helpers.js";
import type { PadModel } from "./pad.js";

export interface ViewModel extends Model<InferAttributes<ViewModel>, InferCreationAttributes<ViewModel>> {
	id: CreationOptional<ID>;
	padId: ForeignKey<PadModel["id"]>;
	name: string;
	baseLayer: string;
	layers: string;
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
			baseLayer : { type: DataTypes.TEXT, allowNull: false },
			layers : {
				type: DataTypes.TEXT,
				allowNull: false,
				get: function(this: ViewModel) {
					return JSON.parse(this.getDataValue("layers"));
				},
				set: function(this: ViewModel, v) {
					this.setDataValue("layers", JSON.stringify(v));
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

	async createView(padId: PadId, data: View<CRU.CREATE_VALIDATED>): Promise<View> {
		if(data.name == null || data.name.trim().length == 0)
			throw new Error("No name provided.");

		const newData = await this._db.helpers._createPadObject<View>("View", padId, data);

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