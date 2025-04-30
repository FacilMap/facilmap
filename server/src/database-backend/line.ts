import { and, col, type CreationOptional, DataTypes, fn, type ForeignKey, type HasManyGetAssociationsMixin, type InferAttributes, type InferCreationAttributes, Model, Op, where } from "sequelize";
import type { BboxWithZoom, ID, Latitude, ExtraInfo, Longitude, Point, TrackPoint, Stroke, Colour, RouteMode, Width, BboxWithExcept } from "facilmap-types";
import DatabaseBackend from "./database-backend.js";
import { bulkCreateInBatches, createModel, dataDefinition, dataFromArr, type DataModel, dataToArr, findAllStreamed, getDefaultIdType, getJsonType, getLatType, getLonType, getPosType, getVirtualLatType, getVirtualLonType, makeBboxCondition, makeNotNullForeignKey } from "./utils.js";
import { isEqual, pick } from "lodash-es";
import type { MapModel } from "./map.js";
import type { Point as GeoJsonPoint } from "geojson";
import type { TypeModel } from "./type.js";
import { type Optional } from "facilmap-utils";
import { getI18n } from "../i18n.js";
import { mapAsyncIterable } from "../utils/streams.js";
import type { RawLine } from "../utils/permissions.js";

export interface LineModel extends Model<InferAttributes<LineModel>, InferCreationAttributes<LineModel>> {
	id: CreationOptional<ID>;
	mapId: ForeignKey<MapModel["id"]>;
	routePoints: Point[];
	typeId: ForeignKey<TypeModel["id"]>;
	mode: RouteMode;
	colour: Colour;
	width: Width;
	stroke: Stroke;
	name: string;
	distance: CreationOptional<number | null>;
	time: CreationOptional<number | null>;
	ascent: CreationOptional<number | null>;
	descent: CreationOptional<number | null>;
	top: Latitude;
	bottom: Latitude;
	left: Longitude;
	right: Longitude;
	extraInfo: CreationOptional<ExtraInfo | null>;
	identity: Buffer | null;

	getLinePoints: HasManyGetAssociationsMixin<LinePointModel>;
}

export interface LineDataModel extends DataModel, Model<InferAttributes<LineDataModel>, InferCreationAttributes<LineDataModel>> {
	lineId: ForeignKey<LineModel["id"]>;
}

export interface LinePointModel extends Model<InferAttributes<LinePointModel>, InferCreationAttributes<LinePointModel>> {
	id: CreationOptional<ID>;
	lineId: ForeignKey<LineModel["id"]>;
	pos: GeoJsonPoint;
	lat: Latitude;
	lon: Longitude;
	zoom: number;
	idx: number;
	ele: number | null;
}

export default class DatabaseLinesBackend {

	LineModel = createModel<LineModel>();
	LinePointModel = createModel<LinePointModel>();
	LineDataModel = createModel<LineDataModel>();

	backend: DatabaseBackend;

	constructor(backend: DatabaseBackend) {
		this.backend = backend;

		this.LineModel.init({
			id: getDefaultIdType(),
			routePoints : getJsonType<Point[]>("routePoints", {
				allowNull: false,
				set: (v) => v.map((p) => ({
					...p,
					lat: Number(p.lat.toFixed(6)),
					lon: Number(p.lon.toFixed(6))
				})),
				validate: {
					minTwo: (routePoints) => {
						if(!Array.isArray(routePoints))
							throw new Error(getI18n().t("database.route-points-not-an-array-error"));
						if(routePoints.length < 2)
							throw new Error(getI18n().t("database.route-points-less-than-two-points-error"));
					}
				}
			}),
			mode : { type: DataTypes.TEXT, allowNull: false },
			colour : { type: DataTypes.STRING(6), allowNull: false },
			width : { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			stroke: { type: DataTypes.TEXT, allowNull: false },
			name : { type: DataTypes.TEXT, allowNull: false },
			distance : { type: DataTypes.FLOAT(24, 2).UNSIGNED, allowNull: true },
			time : {
				type: DataTypes.INTEGER.UNSIGNED,
				allowNull: true,
				set: function(this: LineModel, v: number | null) {
					// Round number to avoid integer column error in Postgres
					this.setDataValue("time", v != null ? Math.round(v) : v);
				},
				defaultValue: null
			},
			ascent : {
				type: DataTypes.INTEGER.UNSIGNED,
				allowNull: true,
				set: function(this: LineModel, v: number | null) {
					// Round number to avoid integer column error in Postgres
					this.setDataValue("ascent", v != null ? Math.round(v) : v);
				},
				defaultValue: null
			},
			descent : {
				type: DataTypes.INTEGER.UNSIGNED,
				allowNull: true,
				set: function(this: LineModel, v: number | null) {
					// Round number to avoid integer column error in Postgres
					this.setDataValue("descent", v != null ? Math.round(v) : v);
				},
				defaultValue: null
			},
			top: getLatType(),
			bottom: getLatType(),
			left: getLonType(),
			right: getLonType(),
			extraInfo: getJsonType("extraInfo", { allowNull: true }),
			identity: { type: DataTypes.BLOB, allowNull: true }
		}, {
			sequelize: this.backend._conn,
			modelName: "Line"
		});

		this.LinePointModel.init({
			id: getDefaultIdType(),
			lat: getVirtualLatType(),
			lon: getVirtualLonType(),
			pos: getPosType(),
			zoom: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, validate: { min: 1, max: 20 } },
			idx: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			ele: {
				type: DataTypes.INTEGER,
				allowNull: true,
				set: function(this: LinePointModel, v: number | null) {
					// Round number to avoid integer column error in Postgres
					this.setDataValue("ele", v != null ? Math.round(v) : v);
				}
			}
		}, {
			sequelize: this.backend._conn,
			indexes: [
				{ fields: [ "lineId", "zoom" ] }
				// pos index is created in migration
			],
			modelName: "LinePoint"
		});

		this.LineDataModel.init(dataDefinition, {
			sequelize: this.backend._conn,
			modelName: "LineData"
		});
	}

	afterInit(): void {
		this.LineModel.belongsTo(this.backend.maps.MapModel, makeNotNullForeignKey("map", "mapId"));
		this.backend.maps.MapModel.hasMany(this.LineModel, { foreignKey: "mapId" });

		// TODO: Cascade
		this.LineModel.belongsTo(this.backend.types.TypeModel, makeNotNullForeignKey("type", "typeId", true));

		this.LinePointModel.belongsTo(this.LineModel, makeNotNullForeignKey("line", "lineId"));
		this.LineModel.hasMany(this.LinePointModel, { foreignKey: "lineId" });

		this.LineDataModel.belongsTo(this.LineModel, makeNotNullForeignKey("line", "lineId"));
		this.LineModel.hasMany(this.LineDataModel, { foreignKey: "lineId" });
	}

	protected prepareLine(line: LineModel): RawLine {
		const data = line.toJSON() as any;
		data.data = dataFromArr(data.lineData);
		delete data.lineData;
		return data;
	}

	async* getMapLines(mapId: ID, fields?: Array<keyof RawLine>): AsyncIterable<RawLine> {
		for await (const obj of findAllStreamed(this.LineModel, {
			where: {
				mapId
			},
			include: [this.LineDataModel],
			...fields ? { attributes: fields } : {}
		})) {
			yield this.prepareLine(obj);
		}
	}

	async* getMapLinesByType(mapId: ID, typeId: ID): AsyncIterable<RawLine> {
		for await (const obj of findAllStreamed(this.LineModel, {
			where: {
				mapId,
				typeId
			},
			include: [this.LineDataModel],
		})) {
			yield this.prepareLine(obj);
		}
	}

	async isTypeUsed(mapId: ID, typeId: ID): Promise<boolean> {
		return !!await this.LineModel.findOne({ where: { mapId, typeId }, attributes: ["id"] });
	}

	async lineExists(mapId: ID, lineId: ID): Promise<boolean> {
		return !!await this.LineModel.findOne({ where: { mapId, id: lineId }, attributes: ["id"] });
	}

	async getLine(mapId: ID, lineId: ID): Promise<RawLine | undefined> {
		const entry = await this.LineModel.findOne({
			where: { id: lineId, mapId },
			include: [this.LineDataModel],
			nest: true
		});

		return entry ? this.prepareLine(entry) : undefined;
	}

	async searchLines(mapId: ID, searchText: string): Promise<RawLine[]> {
		const objs = await this.LineModel.findAll({
			where: and(
				{ mapId },
				where(fn("lower", col(`Line.name`)), {[Op.like]: `%${searchText.toLowerCase()}%`})
			)
		});
		return objs.map((obj) => this.prepareLine(obj));
	}

	protected async setLineData(lineId: ID, data: Record<ID, string>, options?: { noClear?: boolean }): Promise<void> {
		if (!options?.noClear) {
			await this.LineDataModel.destroy({ where: { lineId } });
		}
		await this.LineDataModel.bulkCreate(dataToArr(data, { lineId }));
	}

	async createLine(mapId: ID, data: Optional<Omit<RawLine, "mapId">, "id">): Promise<RawLine> {
		const result = {
			...(await this.LineModel.create({ ...data, mapId })).toJSON() as any,
			data: data.data ?? {}
		};
		if (data.data) {
			await this.setLineData(result.id, data.data, { noClear: true });
		}

		return result;
	}

	async updateLine(mapId: ID, lineId: ID, data: Partial<Omit<RawLine, "id" | "mapId">>): Promise<void> {
		if (Object.keys(data).length > 0 && !isEqual(Object.keys(data), ["data"])) {
			// We don’t return the update object since we cannot rely on the return value of the update() method.
			// On some platforms it returns 0 even if the object was found (but no fields were changed).
			await this.LineModel.update(data, { where: { id: lineId, mapId } });
		}

		if (data.data != null) {
			await this.setLineData(lineId, data.data);
		}
	}

	async setLinePoints(mapId: ID, lineId: ID, trackPoints: Point[] | AsyncIterable<Point>, onBatch?: (batch: TrackPoint[]) => void): Promise<void> {
		await this.LinePointModel.destroy({ where: { lineId } });
		await bulkCreateInBatches<TrackPoint>(
			this.LinePointModel,
			mapAsyncIterable(trackPoints, (t) => ({ ...t, lineId })),
			{ onBatch }
		);
	}

	async deleteLine(mapId: ID, lineId: ID): Promise<void> {
		await this.LineModel.destroy({ where: { id: lineId, mapId } });
	}

	async* getLinePointsForLine(lineId: ID, bboxWithZoom?: BboxWithZoom & BboxWithExcept): AsyncIterable<Pick<InferAttributes<LinePointModel>, "lat" | "lon" | "ele" | "zoom" | "idx">> {
		for await (const linePoint of findAllStreamed(this.LinePointModel, {
			attributes: [ /* Needed for findAllStreamed */ "id", "pos", "lat", "lon", "ele", "zoom", "idx" ],
			order: [["idx", "ASC"]],
			where: {
				lineId,
				...bboxWithZoom ? {
					[Op.and]: [
						{ zoom: { [Op.lte]: bboxWithZoom.zoom } },
						makeBboxCondition(this.backend, bboxWithZoom)
					]
				} : {}
			}
		})) {
			yield pick(linePoint.toJSON(), ["lat", "lon", "ele", "zoom", "idx"]);
		}
	}

}
