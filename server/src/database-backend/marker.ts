import { and, col, type CreationOptional, DataTypes, fn, type ForeignKey, type InferAttributes, type InferCreationAttributes, Model, Op, where } from "sequelize";
import type { Colour, ID, Latitude, Longitude, Marker, Shape, Size, Icon, BboxWithExcept } from "facilmap-types";
import { createModel, dataDefinition, dataFromArr, type DataModel, dataToArr, findAllStreamed, getDefaultIdType, getPosType, getVirtualLatType, getVirtualLonType, makeBboxCondition, makeNotNullForeignKey } from "./utils.js";
import DatabaseBackend from "./database-backend.js";
import type { MapModel } from "./map.js";
import type { Point as GeoJsonPoint } from "geojson";
import type { TypeModel } from "./type.js";
import { isEqual } from "lodash-es";
import type { Optional } from "facilmap-utils";

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

export default class DatabaseMarkersBackend {

	MarkerModel = createModel<MarkerModel>();
	MarkerDataModel = createModel<MarkerDataModel>();

	protected backend: DatabaseBackend;

	constructor(backend: DatabaseBackend) {
		this.backend = backend;

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
			sequelize: this.backend._conn,
			// pos index is created in migration
			modelName: "Marker"
		});

		this.MarkerDataModel.init(dataDefinition, {
			sequelize: this.backend._conn,
			modelName: "MarkerData"
		});
	}

	afterInit(): void {
		const MapModel = this.backend.maps.MapModel;
		const TypeModel = this.backend.types.TypeModel;

		MapModel.hasMany(this.MarkerModel, makeNotNullForeignKey("Markers", "mapId"));
		this.MarkerModel.belongsTo(MapModel, makeNotNullForeignKey("map", "mapId"));
		this.MarkerModel.belongsTo(TypeModel, makeNotNullForeignKey("type", "typeId", true));

		this.MarkerDataModel.belongsTo(this.MarkerModel, makeNotNullForeignKey("marker", "markerId"));
		this.MarkerModel.hasMany(this.MarkerDataModel, { foreignKey: "markerId" });
	}

	protected prepareMarker(marker: MarkerModel): Marker {
		const data = marker.toJSON() as any;
		data.data = dataFromArr(data.markerData);
		delete data.markerData;
		return data;
	}

	async* getMapMarkers(mapId: ID, bbox?: BboxWithExcept): AsyncIterable<Marker> {
		for await (const obj of findAllStreamed(this.MarkerModel, {
			where: {
				...makeBboxCondition(this.backend, bbox),
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
				...makeBboxCondition(this.backend, bbox),
				mapId,
				typeId
			},
			include: [this.MarkerDataModel]
		})) {
			yield this.prepareMarker(obj);
		}
	}

	async isTypeUsed(mapId: ID, typeId: ID): Promise<boolean> {
		return !!await this.MarkerModel.findOne({ where: { mapId, typeId }, attributes: ["id"] });
	}

	async markerExists(mapId: ID, markerId: ID): Promise<boolean> {
		return !!await this.MarkerModel.findOne({ where: { mapId, id: markerId }, attributes: ["id"] });
	}

	async getMarker(mapId: ID, markerId: ID): Promise<Marker | undefined> {
		const entry = await this.MarkerModel.findOne({
			where: { id: markerId, mapId },
			include: [this.MarkerDataModel],
			nest: true
		});

		return entry ? this.prepareMarker(entry) : undefined;
	}

	async searchMarkers(mapId: ID, searchText: string): Promise<Marker[]> {
		const objs = await this.MarkerModel.findAll({
			where: and(
				{ mapId },
				where(fn("lower", col(`Marker.name`)), {[Op.like]: `%${searchText.toLowerCase()}%`})
			)
		});

		return objs.map((obj) => this.prepareMarker(obj));
	}

	protected async setMarkerData(markerId: ID, data: Record<ID, string>, options?: { noClear?: boolean }): Promise<void> {
		if (!options?.noClear) {
			await this.MarkerDataModel.destroy({ where: { markerId } });
		}
		await this.MarkerDataModel.bulkCreate(dataToArr(data, { markerId }));
	}

	async createMarker(mapId: ID, data: Optional<Omit<Marker, "mapId">, "id">): Promise<Marker> {
		const result = {
			...(await this.MarkerModel.create({ ...data, mapId })).toJSON(),
			data: data.data ?? {}
		};
		if (data.data) {
			await this.setMarkerData(result.id, data.data, { noClear: true });
		}

		return result;
	}

	async updateMarker(mapId: ID, markerId: ID, data: Partial<Omit<Marker, "mapId" | "id">>): Promise<void> {
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
