import { type CreationOptional, DataTypes, type ForeignKey, type InferAttributes, type InferCreationAttributes, Model } from "sequelize";
import type { BboxWithZoom, CRU, Colour, ID, Latitude, Longitude, Marker, PadId, Shape, Size, Symbol, Type } from "facilmap-types";
import { type BboxWithExcept, createModel, dataDefinition, type DataModel, getDefaultIdType, getPosType, getVirtualLatType, getVirtualLonType, makeNotNullForeignKey } from "./helpers.js";
import Database from "./database.js";
import { getElevationForPoint, resolveCreateMarker, resolveUpdateMarker } from "facilmap-utils";
import type { PadModel } from "./pad.js";
import type { Point as GeoJsonPoint } from "geojson";
import type { TypeModel } from "./type.js";

export interface MarkerModel extends Model<InferAttributes<MarkerModel>, InferCreationAttributes<MarkerModel>> {
	id: CreationOptional<ID>;
	padId: ForeignKey<PadModel["id"]>;
	pos: GeoJsonPoint;
	lat: Latitude;
	lon: Longitude;
	name: string;
	typeId: ForeignKey<TypeModel["id"]>;
	colour: Colour;
	size: Size;
	symbol: Symbol;
	shape: Shape;
	ele: number | null;
	toJSON: () => Marker;
}

export default class DatabaseMarkers {

	MarkerModel = createModel<MarkerModel>();
	MarkerDataModel = createModel<DataModel>();

	_db: Database;

	constructor(database: Database) {
		this._db = database;

		this.MarkerModel.init({
			id: getDefaultIdType(),
			lat: getVirtualLatType(),
			lon: getVirtualLonType(),
			pos: getPosType(),
			name : { type: DataTypes.TEXT, allowNull: false },
			colour : { type: DataTypes.STRING(6), allowNull: false },
			size : { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			symbol : { type: DataTypes.TEXT, allowNull: false },
			shape : { type: DataTypes.TEXT, allowNull: false },
			ele: {
				type: DataTypes.INTEGER,
				allowNull: true,
				set: function(this: MarkerModel, v: number | null) {
					// Round number to avoid integer column error in Postgres
					this.setDataValue("ele", v != null ? Math.round(v) : v);
				},
				defaultValue: null
			}
		}, {
			sequelize: this._db._conn,
			// pos index is created in migration
			modelName: "Marker"
		});

		this.MarkerDataModel.init(dataDefinition, {
			sequelize: this._db._conn,
			modelName: "MarkerData"
		});
	}

	afterInit(): void {
		const PadModel = this._db.pads.PadModel;
		const TypeModel = this._db.types.TypeModel;

		PadModel.hasMany(this.MarkerModel, makeNotNullForeignKey("Markers", "padId"));
		this.MarkerModel.belongsTo(PadModel, makeNotNullForeignKey("pad", "padId"));
		this.MarkerModel.belongsTo(TypeModel, makeNotNullForeignKey("type", "typeId", true));

		this.MarkerDataModel.belongsTo(this.MarkerModel, makeNotNullForeignKey("marker", "markerId"));
		this.MarkerModel.hasMany(this.MarkerDataModel, { foreignKey: "markerId" });
	}

	getPadMarkers(padId: PadId, bbox?: BboxWithZoom & BboxWithExcept): AsyncIterable<Marker> {
		return this._db.helpers._getPadObjects<Marker>("Marker", padId, { where: this._db.helpers.makeBboxCondition(bbox) });
	}

	getPadMarkersByType(padId: PadId, typeId: ID): AsyncIterable<Marker> {
		return this._db.helpers._getPadObjects<Marker>("Marker", padId, { where: { padId: padId, typeId: typeId } });
	}

	getMarker(padId: PadId, markerId: ID): Promise<Marker> {
		return this._db.helpers._getPadObject("Marker", padId, markerId);
	}

	async createMarker(padId: PadId, data: Marker<CRU.CREATE_VALIDATED>): Promise<Marker> {
		const type = await this._db.types.getType(padId, data.typeId);
		if (type.type !== "marker") {
			throw new Error(`Cannot use ${type.type} type for marker.`);
		}

		const result = await this._db.helpers._createPadObject<Marker>("Marker", padId, resolveCreateMarker(data, type));
		this._db.emit("marker", padId, result);

		if (data.ele === undefined) {
			getElevationForPoint(data).then(async (ele) => {
				if (ele != null) {
					await this.updateMarker(padId, result.id, { ele }, true);
				}
			}).catch((err) => {
				console.warn("Error updating marker elevation", err);
			});
		}

		return result;
	}

	async updateMarker(padId: PadId, markerId: ID, data: Omit<Marker<CRU.UPDATE_VALIDATED>, "id">, noHistory = false): Promise<Marker> {
		const originalMarker = await this.getMarker(padId, markerId);
		const newType = await this._db.types.getType(padId, data.typeId ?? originalMarker.typeId);
		return await this._updateMarker(originalMarker, data, newType, noHistory);
	}

	async _updateMarker(originalMarker: Marker, data: Omit<Marker<CRU.UPDATE_VALIDATED>, "id">, newType: Type, noHistory = false): Promise<Marker> {
		if (newType.type !== "marker") {
			throw new Error(`Cannot use ${newType.type} type for marker.`);
		}

		const update = resolveUpdateMarker(originalMarker, data, newType);

		const result = await this._db.helpers._updatePadObject<Marker>("Marker", originalMarker.padId, originalMarker.id, update, noHistory);

		this._db.emit("marker", originalMarker.padId, result);

		if (update.lat != null && update.lon != null && update.ele === undefined) {
			getElevationForPoint({ lat: update.lat, lon: update.lon }).then(async (ele) => {
				if (ele != null) {
					await this.updateMarker(originalMarker.padId, originalMarker.id, { ele }, true);
				}
			}).catch((err) => {
				console.warn("Error updating marker elevation", err);
			});
		}

		return result;
	}

	async deleteMarker(padId: PadId, markerId: ID): Promise<Marker> {
		const result = await this._db.helpers._deletePadObject<Marker>("Marker", padId, markerId);
		this._db.emit("deleteMarker", padId, { id: result.id });
		return result;
	}

}
