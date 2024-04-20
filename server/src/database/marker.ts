import { type CreationOptional, DataTypes, type ForeignKey, type InferAttributes, type InferCreationAttributes, Model } from "sequelize";
import type { BboxWithZoom, CRU, Colour, ID, Latitude, Longitude, Marker, MapId, Shape, Size, Icon, Type } from "facilmap-types";
import { type BboxWithExcept, createModel, dataDefinition, type DataModel, getDefaultIdType, getPosType, getVirtualLatType, getVirtualLonType, makeNotNullForeignKey } from "./helpers.js";
import Database from "./database.js";
import { getElevationForPoint, resolveCreateMarker, resolveUpdateMarker } from "facilmap-utils";
import type { MapModel } from "./map.js";
import type { Point as GeoJsonPoint } from "geojson";
import type { TypeModel } from "./type.js";
import { getI18n } from "../i18n.js";

export interface MarkerModel extends Model<InferAttributes<MarkerModel>, InferCreationAttributes<MarkerModel>> {
	id: CreationOptional<ID>;
	padId: ForeignKey<MapModel["id"]>;
	pos: GeoJsonPoint;
	lat: Latitude;
	lon: Longitude;
	name: string;
	typeId: ForeignKey<TypeModel["id"]>;
	colour: Colour;
	size: Size;
	icon: Icon;
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
			icon : { type: DataTypes.TEXT, allowNull: false },
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
		const MapModel = this._db.maps.MapModel;
		const TypeModel = this._db.types.TypeModel;

		MapModel.hasMany(this.MarkerModel, makeNotNullForeignKey("Markers", "padId"));
		this.MarkerModel.belongsTo(MapModel, makeNotNullForeignKey("pad", "padId"));
		this.MarkerModel.belongsTo(TypeModel, makeNotNullForeignKey("type", "typeId", true));

		this.MarkerDataModel.belongsTo(this.MarkerModel, makeNotNullForeignKey("marker", "markerId"));
		this.MarkerModel.hasMany(this.MarkerDataModel, { foreignKey: "markerId" });
	}

	getMapMarkers(mapId: MapId, bbox?: BboxWithZoom & BboxWithExcept): AsyncIterable<Marker> {
		return this._db.helpers._getMapObjects<Marker>("Marker", mapId, { where: this._db.helpers.makeBboxCondition(bbox) });
	}

	getMapMarkersByType(mapId: MapId, typeId: ID): AsyncIterable<Marker> {
		return this._db.helpers._getMapObjects<Marker>("Marker", mapId, { where: { padId: mapId, typeId: typeId } });
	}

	getMarker(mapId: MapId, markerId: ID): Promise<Marker> {
		return this._db.helpers._getMapObject("Marker", mapId, markerId);
	}

	async createMarker(mapId: MapId, data: Marker<CRU.CREATE_VALIDATED>): Promise<Marker> {
		const type = await this._db.types.getType(mapId, data.typeId);
		if (type.type !== "marker") {
			throw new Error(getI18n().t("database.cannot-use-type-for-marker-error", { type: type.type }));
		}

		const result = await this._db.helpers._createMapObject<Marker>("Marker", mapId, resolveCreateMarker(data, type));
		this._db.emit("marker", mapId, result);

		if (data.ele === undefined) {
			getElevationForPoint(data).then(async (ele) => {
				if (ele != null) {
					await this.updateMarker(mapId, result.id, { ele }, true);
				}
			}).catch((err) => {
				console.warn("Error updating marker elevation", err);
			});
		}

		return result;
	}

	async updateMarker(mapId: MapId, markerId: ID, data: Marker<CRU.UPDATE_VALIDATED>, noHistory = false): Promise<Marker> {
		const originalMarker = await this.getMarker(mapId, markerId);
		const newType = await this._db.types.getType(mapId, data.typeId ?? originalMarker.typeId);
		return await this._updateMarker(originalMarker, data, newType, noHistory);
	}

	async _updateMarker(originalMarker: Marker, data: Marker<CRU.UPDATE_VALIDATED>, newType: Type, noHistory = false): Promise<Marker> {
		if (newType.type !== "marker") {
			throw new Error(getI18n().t("database.cannot-use-type-for-marker-error", { type: newType.type }));
		}

		const update = resolveUpdateMarker(originalMarker, data, newType);

		if (Object.keys(update).length > 0) {
			const result = await this._db.helpers._updateMapObject<Marker>("Marker", originalMarker.padId, originalMarker.id, update, noHistory);

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
		} else {
			return originalMarker;
		}
	}

	async deleteMarker(mapId: MapId, markerId: ID): Promise<Marker> {
		const result = await this._db.helpers._deleteMapObject<Marker>("Marker", mapId, markerId);
		this._db.emit("deleteMarker", mapId, { id: result.id });
		return result;
	}

}
