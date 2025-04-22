import { type CreationOptional, DataTypes, type ForeignKey, type InferAttributes, type InferCreationAttributes, Model } from "sequelize";
import type { CRU, Colour, ID, Latitude, Longitude, Marker, Shape, Size, Icon } from "facilmap-types";
import { type BboxWithExcept, createModel, dataDefinition, type DataModel, findAllStreamed, getDefaultIdType, getPosType, getVirtualLatType, getVirtualLonType, makeNotNullForeignKey } from "./helpers.js";
import DatabaseBackend from "./database.js";
import type { MapModel } from "./map.js";
import type { Point as GeoJsonPoint } from "geojson";
import type { TypeModel } from "./type.js";
import { isEqual } from "lodash-es";

export interface MarkerModel extends Model<InferAttributes<MarkerModel>, InferCreationAttributes<MarkerModel>> {
	id: CreationOptional<ID>;
	mapId: ForeignKey<MapModel["id"]>;
	pos: CreationOptional<GeoJsonPoint>;
	lat: Latitude;
	lon: Longitude;
	name: string;
	typeId: ForeignKey<TypeModel["id"]>;
	colour: Colour;
	size: Size;
	icon: Icon;
	shape: Shape;
	ele: number | null;
}

export interface MarkerDataModel extends DataModel, Model<InferAttributes<MarkerDataModel>, InferCreationAttributes<MarkerDataModel>> {
	markerId: ForeignKey<MarkerModel["id"]>;
}

export default class DatabaseMarkers {

	MarkerModel = createModel<MarkerModel>();
	MarkerDataModel = createModel<MarkerDataModel>();

	_db: DatabaseBackend;

	constructor(database: DatabaseBackend) {
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

		MapModel.hasMany(this.MarkerModel, makeNotNullForeignKey("Markers", "mapId"));
		this.MarkerModel.belongsTo(MapModel, makeNotNullForeignKey("map", "mapId"));
		this.MarkerModel.belongsTo(TypeModel, makeNotNullForeignKey("type", "typeId", true));

		this.MarkerDataModel.belongsTo(this.MarkerModel, makeNotNullForeignKey("marker", "markerId"));
		this.MarkerModel.hasMany(this.MarkerDataModel, { foreignKey: "markerId" });
	}

	protected prepareMarker(marker: MarkerModel): Marker {
		const data = marker.toJSON() as any;
		data.data = this._db.helpers._dataFromArr(data.markerData);
		delete data.markerData;
		return data;
	}

	async* getMapMarkers(mapId: ID, bbox?: BboxWithExcept): AsyncIterable<Marker> {
		for await (const obj of findAllStreamed(this.MarkerModel, {
			where: {
				...this._db.helpers.makeBboxCondition(bbox),
				mapId
			},
			include: [this.MarkerDataModel]
		})) {
			yield this.prepareMarker(obj);
		}
	}

	async* getMapMarkersByType(mapId: ID, typeId: ID, bbox?: BboxWithExcept): AsyncIterable<Marker> {
		for await (const obj of findAllStreamed(this.MarkerModel, {
			where: {
				...this._db.helpers.makeBboxCondition(bbox),
				mapId,
				typeId
			},
			include: [this.MarkerDataModel]
		})) {
			yield this.prepareMarker(obj);
		}
	}

	async getMarker(mapId: ID, markerId: ID): Promise<Marker | undefined> {
		const entry = await this.MarkerModel.findOne({
			where: { id: markerId, mapId },
			include: [this.MarkerDataModel],
			nest: true
		});

		return entry ? this.prepareMarker(entry) : undefined;
	}

	protected async setMarkerData(markerId: ID, data: Record<ID, string>, options?: { noClear?: boolean }): Promise<void> {
		if (!options?.noClear) {
			await this.MarkerDataModel.destroy({ where: { markerId } });
		}
		await this.MarkerDataModel.bulkCreate(this._db.helpers._dataToArr(data, { markerId }));
	}

	async createMarker(mapId: ID, data: Marker<CRU.CREATE_VALIDATED> & Required<Pick<Marker<CRU.CREATE_VALIDATED>, "icon" | "shape" | "colour" | "size">> & { id?: ID }): Promise<Marker> {
		const obj = this.MarkerModel.build({ ...data, mapId });

		const result: any = (await obj.save()).toJSON();
		result.data = data.data ?? {};
		if (data.data) {
			await this.setMarkerData(result.id, data.data, { noClear: true });
		}

		return result;
	}

	async updateMarker(mapId: ID, markerId: ID, data: Marker<CRU.UPDATE_VALIDATED>): Promise<void> {
		if (Object.keys(data).length > 0 && !isEqual(Object.keys(data), ["data"])) {
			// We don’t return the update object since we cannot rely on the return value of the update() method.
			// On some platforms it returns 0 even if the object was found (but no fields were changed).
			await this.MarkerModel.update(data, { where: { id: markerId, mapId } });
		}

		if (data.data != null) {
			await this.setMarkerData(markerId, data.data);
		}
	}

	async deleteMarker(mapId: ID, markerId: ID): Promise<void> {
		await this.MarkerModel.destroy({ where: { id: markerId, mapId } });
	}

}
