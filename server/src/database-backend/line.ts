import { type CreationOptional, DataTypes, type ForeignKey, type HasManyGetAssociationsMixin, type InferAttributes, type InferCreationAttributes, Model, Op } from "sequelize";
import type { BboxWithZoom, ID, Latitude, Line, ExtraInfo, Longitude, Point, Route, TrackPoint, CRU, RouteInfo, Stroke, Colour, RouteMode, Width, Type, LinePoints } from "facilmap-types";
import DatabaseBackend from "./database.js";
import { type BboxWithExcept, createModel, dataDefinition, type DataModel, findAllStreamed, getDefaultIdType, getJsonType, getLatType, getLonType, getPosType, getVirtualLatType, getVirtualLonType, makeNotNullForeignKey } from "./helpers.js";
import { chunk, groupBy, isEqual, mapValues, omit } from "lodash-es";
import { calculateRouteForLine } from "../routing/routing.js";
import type { MapModel } from "./map.js";
import type { Point as GeoJsonPoint } from "geojson";
import type { TypeModel } from "./type.js";
import { resolveCreateLine, resolveUpdateLine } from "facilmap-utils";
import { getI18n } from "../i18n.js";
import { mapAsyncIterable } from "../utils/streams.js";

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

	getLinePoints: HasManyGetAssociationsMixin<LinePointModel>;
	toJSON: () => Line;
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
	toJSON: () => TrackPoint & { lineId: ID; pos: GeoJsonPoint };
}

export default class DatabaseLines {

	LineModel = createModel<LineModel>();
	LinePointModel = createModel<LinePointModel>();
	LineDataModel = createModel<LineDataModel>();

	_db: DatabaseBackend;

	constructor(database: DatabaseBackend) {
		this._db = database;

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
			extraInfo: getJsonType("extraInfo", { allowNull: true })
		}, {
			sequelize: this._db._conn,
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
			sequelize: this._db._conn,
			indexes: [
				{ fields: [ "lineId", "zoom" ] }
				// pos index is created in migration
			],
			modelName: "LinePoint"
		});

		this.LineDataModel.init(dataDefinition, {
			sequelize: this._db._conn,
			modelName: "LineData"
		});
	}

	afterInit(): void {
		this.LineModel.belongsTo(this._db.maps.MapModel, makeNotNullForeignKey("map", "mapId"));
		this._db.maps.MapModel.hasMany(this.LineModel, { foreignKey: "mapId" });

		// TODO: Cascade
		this.LineModel.belongsTo(this._db.types.TypeModel, makeNotNullForeignKey("type", "typeId", true));

		this.LinePointModel.belongsTo(this.LineModel, makeNotNullForeignKey("line", "lineId"));
		this.LineModel.hasMany(this.LinePointModel, { foreignKey: "lineId" });

		this.LineDataModel.belongsTo(this.LineModel, makeNotNullForeignKey("line", "lineId"));
		this.LineModel.hasMany(this.LineDataModel, { foreignKey: "lineId" });
	}

	protected prepareLine(line: LineModel): Line {
		const data = line.toJSON() as any;
		data.data = this._db.helpers._dataFromArr(data.lineData);
		delete data.lineData;
		return data;
	}

	async* getMapLines(mapId: ID, fields?: Array<keyof Line>): AsyncIterable<Line> {
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

	async* getMapLinesByType(mapId: ID, typeId: ID): AsyncIterable<Line> {
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

	async getLine(mapId: ID, lineId: ID): Promise<Line | undefined> {
		const entry = await this.LineModel.findOne({
			where: { id: lineId, mapId },
			include: [this.LineDataModel],
			nest: true
		});

		return entry ? this.prepareLine(entry) : undefined;
	}

	protected async setLineData(lineId: ID, data: Record<ID, string>, options?: { noClear?: boolean }): Promise<void> {
		if (!options?.noClear) {
			await this.LineDataModel.destroy({ where: { lineId } });
		}
		await this.LineDataModel.bulkCreate(this._db.helpers._dataToArr(data, { lineId }));
	}

	async createLine(mapId: ID, data: Line<CRU.CREATE_VALIDATED> & Required<Pick<Line<CRU.CREATE_VALIDATED>, "mode" | "colour" | "width" | "stroke">> & Pick<Line, "top" | "right" | "bottom" | "left"> & { id?: ID }): Promise<Line> {
		const obj = this.LineModel.build({ ...data, mapId });

		const result: any = (await obj.save()).toJSON();
		result.data = data.data ?? {};
		if (data.data) {
			await this.setLineData(result.id, data.data, { noClear: true });
		}

		return result;
	}

	async updateLine(mapId: ID, lineId: ID, data: Line<CRU.UPDATE_VALIDATED>): Promise<void> {
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
		await this._db.helpers._bulkCreateInBatches<TrackPoint>(
			this.LinePointModel,
			mapAsyncIterable(trackPoints, (t) => ({ ...t, lineId })),
			onBatch
		);
	}

	async deleteLine(mapId: ID, lineId: ID): Promise<void> {
		await this.LineModel.destroy({ where: { id: lineId, mapId } });
	}

	async* getLinePointsForMap(mapId: ID, bboxWithZoom?: BboxWithZoom & BboxWithExcept): AsyncIterable<LinePoints> {
		const lines = await this.LineModel.findAll({ attributes: ["id"], where: { mapId } });
		const chunks = chunk(lines.map((line) => line.id), 50000);
		for (const lineIds of chunks) {
			const linePoints = await this.LinePointModel.findAll({
				where: {
					[Op.and]: [
						{
							...bboxWithZoom ? {
								zoom: { [Op.lte]: bboxWithZoom.zoom }
							} : {},
							lineId: { [Op.in]: lineIds }
						},
						this._db.helpers.makeBboxCondition(bboxWithZoom)
					]
				},
				attributes: ["pos", "lat", "lon", "ele", "zoom", "idx", "lineId"]
			});

			for (const [key, val] of Object.entries(groupBy(linePoints, "lineId"))) {
				yield {
					lineId: Number(key),
					trackPoints: val.map((p) => omit(p.toJSON(), ["lineId", "pos"]))
				};
			}
		}
	}

	async* getLinePointsForLine(lineId: ID, bboxWithZoom?: BboxWithZoom & BboxWithExcept): AsyncIterable<TrackPoint> {
		for await (const linePoint of findAllStreamed(this.LinePointModel, {
			attributes: [ /* Needed for findAllStreamed */ "id", "pos", "lat", "lon", "ele", "zoom", "idx" ],
			order: [["idx", "ASC"]],
			where: {
				lineId,
				...bboxWithZoom ? {
					[Op.and]: [
						{ zoom: { [Op.lte]: bboxWithZoom.zoom } },
						this._db.helpers.makeBboxCondition(bboxWithZoom)
					]
				} : {}
			}
		})) {
			yield omit(linePoint.toJSON(), ["id", "pos"]) as TrackPoint;
		}
	}

}
