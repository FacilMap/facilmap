import { type CreationAttributes, type CreationOptional, DataTypes, type ForeignKey, type HasManyGetAssociationsMixin, type InferAttributes, type InferCreationAttributes, Model, Op } from "sequelize";
import type { BboxWithZoom, ID, Latitude, Line, ExtraInfo, Longitude, Point, Route, TrackPoint, CRU, RouteInfo, Stroke, Colour, RouteMode, Width, Type, LinePoints } from "facilmap-types";
import Database from "./database.js";
import { type BboxWithExcept, createModel, dataDefinition, type DataModel, getDefaultIdType, getLatType, getLonType, getPosType, getVirtualLatType, getVirtualLonType, makeNotNullForeignKey } from "./helpers.js";
import { chunk, groupBy, isEqual, mapValues, omit } from "lodash-es";
import { calculateRouteForLine } from "../routing/routing.js";
import type { MapModel } from "./map.js";
import type { Point as GeoJsonPoint } from "geojson";
import type { TypeModel } from "./type";
import { resolveCreateLine, resolveUpdateLine } from "facilmap-utils";
import { getI18n } from "../i18n.js";

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
	LineDataModel = createModel<DataModel>();

	_db: Database;

	constructor(database: Database) {
		this._db = database;

		this.LineModel.init({
			id: getDefaultIdType(),
			routePoints : {
				type: DataTypes.TEXT,
				allowNull: false,
				get: function(this: LineModel) {
					const routePoints = this.getDataValue("routePoints") as any as string; // https://github.com/sequelize/sequelize/issues/11558
					return routePoints != null ? JSON.parse(routePoints) : routePoints;
				},
				set: function(this: LineModel, v: Point[]) {
					for(let i=0; i<v.length; i++) {
						v[i].lat = Number(v[i].lat.toFixed(6));
						v[i].lon = Number(v[i].lon.toFixed(6));
					}
					this.setDataValue("routePoints", JSON.stringify(v) as any);
				},
				validate: {
					minTwo: function(val: string) {
						const routePoints = JSON.parse(val);
						if(!Array.isArray(routePoints))
							throw new Error(getI18n().t("database.route-points-not-an-array-error"));
						if(routePoints.length < 2)
							throw new Error(getI18n().t("database.route-points-less-than-two-points-error"));
					}
				}
			},
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
			extraInfo: {
				type: DataTypes.TEXT,
				allowNull: true,
				get: function(this: LineModel) {
					const extraInfo = this.getDataValue("extraInfo") as any as string; // https://github.com/sequelize/sequelize/issues/11558
					return extraInfo != null ? JSON.parse(extraInfo) : extraInfo;
				},
				set: function(this: LineModel, v: ExtraInfo) {
					this.setDataValue("extraInfo", v != null ? JSON.stringify(v) as any : v);
				},
				defaultValue: null
			}
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

	getMapLines(mapId: ID, fields?: Array<keyof Line>): AsyncIterable<Line> {
		const cond = fields ? { attributes: fields } : { };
		return this._db.helpers._getMapObjects<Line>("Line", mapId, cond);
	}

	getMapLinesByType(mapId: ID, typeId: ID): AsyncIterable<Line> {
		return this._db.helpers._getMapObjects<Line>("Line", mapId, { where: { typeId } });
	}

	getLine(mapId: ID, lineId: ID, options?: { notFound404?: boolean }): Promise<Line> {
		return this._db.helpers._getMapObject<Line>("Line", mapId, lineId, options);
	}

	async createLine(mapId: ID, data: Line<CRU.CREATE_VALIDATED>, trackPointsFromRoute?: Route): Promise<Line> {
		const type = await this._db.types.getType(mapId, data.typeId);
		if (type.type !== "line") {
			throw new Error(getI18n().t("database.cannot-use-type-for-line-error", { type: type.type }));
		}

		const resolvedData = resolveCreateLine(data, type);

		const { trackPoints, ...routeInfo } = await calculateRouteForLine(resolvedData, trackPointsFromRoute);

		const createdLine = await this._db.helpers._createMapObject<Line>("Line", mapId, omit({ ...resolvedData, ...routeInfo }, "trackPoints" /* Part of data if mode is track */));

		// We have to emit this before calling _setLinePoints so that this event is sent to the client first
		this._db.emit("line", mapId, createdLine);

		await this._setLinePoints(mapId, createdLine.id, trackPoints);

		return createdLine;
	}

	async updateLine(mapId: ID, lineId: ID, data: Line<CRU.UPDATE_VALIDATED>, options?: { noHistory?: boolean; trackPointsFromRoute?: Route; notFound404?: boolean }): Promise<Line> {
		const originalLine = await this.getLine(mapId, lineId, { notFound404: options?.notFound404 });
		const newType = await this._db.types.getType(mapId, data.typeId ?? originalLine.typeId);
		return await this._updateLine(originalLine, data, newType, options);
	}

	async _updateLine(originalLine: Line, data: Line<CRU.UPDATE_VALIDATED>, newType: Type, options?: { noHistory?: boolean; trackPointsFromRoute?: Route; notFound404?: boolean }): Promise<Line> {
		if (newType.type !== "line") {
			throw new Error(getI18n().t("database.cannot-use-type-for-line-error", { type: newType.type }));
		}

		const update = resolveUpdateLine(originalLine, data, newType);

		let routeInfo: RouteInfo | undefined;
		if((update.mode == "track" && update.trackPoints) || (update.routePoints && !isEqual(update.routePoints, originalLine.routePoints)) || (update.mode != null && update.mode != originalLine.mode))
			routeInfo = await calculateRouteForLine({ ...originalLine, ...update }, options?.trackPointsFromRoute);

		Object.assign(update, mapValues(routeInfo, (val) => val == null ? null : val)); // Use null instead of undefined
		delete update.trackPoints; // They came if mode is track

		if (Object.keys(update).length > 0) {
			const newLine = await this._db.helpers._updateMapObject<Line>("Line", originalLine.mapId, originalLine.id, update, options);

			this._db.emit("line", originalLine.mapId, newLine);

			if(routeInfo)
				await this._setLinePoints(originalLine.mapId, originalLine.id, routeInfo.trackPoints);

			return newLine;
		} else {
			return originalLine;
		}
	}

	async _setLinePoints(mapId: ID, lineId: ID, trackPoints: Point[], _noEvent?: boolean): Promise<void> {
		await this.LinePointModel.destroy({ where: { lineId: lineId } });

		const create = [ ];
		for(let i=0; i<trackPoints.length; i++) {
			create.push({ ...trackPoints[i], lineId: lineId });
		}

		const points = await this._db.helpers._bulkCreateInBatches<TrackPoint>(this.LinePointModel, create);

		if(!_noEvent)
			this._db.emit("linePoints", mapId, lineId, points.map((point) => omit(point, ["id", "lineId", "pos"]) as TrackPoint));
	}

	async deleteLine(mapId: ID, lineId: ID, options?: { notFound404?: boolean }): Promise<Line> {
		await this._setLinePoints(mapId, lineId, [ ], true);
		const oldLine = await this._db.helpers._deleteMapObject<Line>("Line", mapId, lineId, options);
		this._db.emit("deleteLine", mapId, { id: lineId });
		return oldLine;
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
		const points = await this.LineModel.build({ id: lineId } satisfies Partial<CreationAttributes<LineModel>> as any).getLinePoints({
			attributes: [ "pos", "lat", "lon", "ele", "zoom", "idx" ],
			order: [["idx", "ASC"]],
			...bboxWithZoom ? {
				where: {
					[Op.and]: [
						{
							zoom: { [Op.lte]: bboxWithZoom.zoom },
						},
						this._db.helpers.makeBboxCondition(bboxWithZoom)
					]
				}
			} : {}
		});
		for (const point of points) {
			yield omit(point.toJSON(), ["pos"]);
		}
	}

}
