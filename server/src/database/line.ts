import { type CreationAttributes, type CreationOptional, DataTypes, type ForeignKey, type HasManyGetAssociationsMixin, type InferAttributes, type InferCreationAttributes, Model, Op } from "sequelize";
import type { BboxWithZoom, ID, Latitude, Line, ExtraInfo, Longitude, PadId, Point, Route, TrackPoint, CRU, RouteInfo, Stroke, Colour, RouteMode, Width, Type, LineTemplate } from "facilmap-types";
import Database from "./database.js";
import { type BboxWithExcept, createModel, dataDefinition, type DataModel, getDefaultIdType, getLatType, getLonType, getPosType, getVirtualLatType, getVirtualLonType, makeNotNullForeignKey } from "./helpers.js";
import { chunk, groupBy, isEqual, mapValues, omit } from "lodash-es";
import { calculateRouteForLine } from "../routing/routing.js";
import type { PadModel } from "./pad";
import type { Point as GeoJsonPoint } from "geojson";
import type { TypeModel } from "./type";
import { getLineTemplate, resolveCreateLine, resolveUpdateLine } from "facilmap-utils";

export type LineWithTrackPoints = Line & {
	trackPoints: TrackPoint[];
}

export interface LineModel extends Model<InferAttributes<LineModel>, InferCreationAttributes<LineModel>> {
	id: CreationOptional<ID>;
	padId: ForeignKey<PadModel["id"]>;
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
							throw new Error("routePoints is not an array");
						if(routePoints.length < 2)
							throw new Error("A line cannot have less than two route points.");
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
		this.LineModel.belongsTo(this._db.pads.PadModel, makeNotNullForeignKey("pad", "padId"));
		this._db.pads.PadModel.hasMany(this.LineModel, { foreignKey: "padId" });

		// TODO: Cascade
		this.LineModel.belongsTo(this._db.types.TypeModel, makeNotNullForeignKey("type", "typeId", true));

		this.LinePointModel.belongsTo(this.LineModel, makeNotNullForeignKey("line", "lineId"));
		this.LineModel.hasMany(this.LinePointModel, { foreignKey: "lineId" });

		this.LineDataModel.belongsTo(this.LineModel, makeNotNullForeignKey("line", "lineId"));
		this.LineModel.hasMany(this.LineDataModel, { foreignKey: "lineId" });
	}

	getPadLines(padId: PadId, fields?: Array<keyof Line>): AsyncIterable<Line> {
		const cond = fields ? { attributes: fields } : { };
		return this._db.helpers._getPadObjects<Line>("Line", padId, cond);
	}

	getPadLinesByType(padId: PadId, typeId: ID): AsyncIterable<Line> {
		return this._db.helpers._getPadObjects<Line>("Line", padId, { where: { typeId: typeId } });
	}

	async getLineTemplate(padId: PadId, data: { typeId: ID }): Promise<LineTemplate> {
		const type = await this._db.types.getType(padId, data.typeId);

		return getLineTemplate(type);
	}

	getLine(padId: PadId, lineId: ID): Promise<Line> {
		return this._db.helpers._getPadObject<Line>("Line", padId, lineId);
	}

	async createLine(padId: PadId, data: Line<CRU.CREATE_VALIDATED>, trackPointsFromRoute?: Route): Promise<Line> {
		const type = await this._db.types.getType(padId, data.typeId);
		if (type.type !== "line") {
			throw new Error(`Cannot use ${type.type} type for line.`);
		}

		const resolvedData = resolveCreateLine(data, type);

		const { trackPoints, ...routeInfo } = await calculateRouteForLine(resolvedData, trackPointsFromRoute);

		const createdLine = await this._db.helpers._createPadObject<Line>("Line", padId, omit({ ...resolvedData, ...routeInfo }, "trackPoints" /* Part of data if mode is track */));

		// We have to emit this before calling _setLinePoints so that this event is sent to the client first
		this._db.emit("line", padId, createdLine);

		await this._setLinePoints(padId, createdLine.id, trackPoints);

		return createdLine;
	}

	async updateLine(padId: PadId, lineId: ID, data: Omit<Line<CRU.UPDATE_VALIDATED>, "id">, noHistory?: boolean, trackPointsFromRoute?: Route): Promise<Line> {
		const originalLine = await this.getLine(padId, lineId);
		const newType = await this._db.types.getType(padId, data.typeId ?? originalLine.typeId);
		return await this._updateLine(originalLine, data, newType, noHistory, trackPointsFromRoute);
	}

	async _updateLine(originalLine: Line, data: Omit<Line<CRU.UPDATE_VALIDATED>, "id">, newType: Type, noHistory?: boolean, trackPointsFromRoute?: Route): Promise<Line> {
		if (newType.type !== "line") {
			throw new Error(`Cannot use ${newType.type} type for line.`);
		}

		const update = {
			...resolveUpdateLine(originalLine, data, newType),
			routePoints: data.routePoints || originalLine.routePoints,
			mode: (data.mode ?? originalLine.mode) || ""
		};

		let routeInfo: RouteInfo | undefined;
		if((update.mode == "track" && update.trackPoints) || !isEqual(update.routePoints, originalLine.routePoints) || update.mode != originalLine.mode)
			routeInfo = await calculateRouteForLine(update, trackPointsFromRoute);

		Object.assign(update, mapValues(routeInfo, (val) => val == null ? null : val)); // Use null instead of undefined
		delete update.trackPoints; // They came if mode is track

		const newLine = await this._db.helpers._updatePadObject<Line>("Line", originalLine.padId, originalLine.id, update, noHistory);

		this._db.emit("line", originalLine.padId, newLine);

		if(routeInfo)
			await this._setLinePoints(originalLine.padId, originalLine.id, routeInfo.trackPoints);

		return newLine;
	}

	async _setLinePoints(padId: PadId, lineId: ID, trackPoints: Point[], _noEvent?: boolean): Promise<void> {
		await this.LinePointModel.destroy({ where: { lineId: lineId } });

		const create = [ ];
		for(let i=0; i<trackPoints.length; i++) {
			create.push({ ...trackPoints[i], lineId: lineId });
		}

		const points = await this._db.helpers._bulkCreateInBatches<TrackPoint>(this.LinePointModel, create);

		if(!_noEvent)
			this._db.emit("linePoints", padId, lineId, points.map((point) => omit(point, ["id", "lineId", "pos"]) as TrackPoint));
	}

	async deleteLine(padId: PadId, lineId: ID): Promise<Line> {
		await this._setLinePoints(padId, lineId, [ ], true);
		const oldLine = await this._db.helpers._deletePadObject<Line>("Line", padId, lineId);
		this._db.emit("deleteLine", padId, { id: lineId });
		return oldLine;
	}

	async* getLinePointsForPad(padId: PadId, bboxWithZoom: BboxWithZoom & BboxWithExcept): AsyncIterable<{ id: ID; trackPoints: TrackPoint[] }> {
		const lines = await this.LineModel.findAll({ attributes: ["id"], where: { padId } });
		const chunks = chunk(lines.map((line) => line.id), 50000);
		for (const lineIds of chunks) {
			const linePoints = await this.LinePointModel.findAll({
				where: {
					[Op.and]: [
						{
							zoom: { [Op.lte]: bboxWithZoom.zoom },
							lineId: { [Op.in]: lineIds }
						},
						this._db.helpers.makeBboxCondition(bboxWithZoom)
					]
				},
				attributes: ["pos", "lat", "lon", "ele", "zoom", "idx", "lineId"]
			});

			for (const [key, val] of Object.entries(groupBy(linePoints, "lineId"))) {
				yield {
					id: Number(key),
					trackPoints: val.map((p) => omit(p.toJSON(), ["lineId", "pos"]))
				};
			}
		}
	}

	async* getAllLinePoints(lineId: ID): AsyncIterable<TrackPoint> {
		const points = await this.LineModel.build({ id: lineId } satisfies Partial<CreationAttributes<LineModel>> as any).getLinePoints({
			attributes: [ "pos", "lat", "lon", "ele", "zoom", "idx" ],
			order: [["idx", "ASC"]]
		});
		for (const point of points) {
			yield omit(point.toJSON(), ["pos"]) as TrackPoint;
		}
	}

}
