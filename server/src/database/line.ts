import { CreationAttributes, CreationOptional, DataTypes, ForeignKey, HasManyGetAssociationsMixin, InferAttributes, InferCreationAttributes, Model, Op } from "sequelize";
import { BboxWithZoom, ID, Latitude, Line, LineCreate, ExtraInfo, LineUpdate, Longitude, PadId, Point, Route, TrackPoint } from "facilmap-types";
import Database from "./database.js";
import { BboxWithExcept, createModel, dataDefinition, DataModel, getDefaultIdType, getLatType, getLonType, getPosType, getVirtualLatType, getVirtualLonType, makeBboxCondition, makeNotNullForeignKey, validateColour } from "./helpers.js";
import { chunk, groupBy, isEqual, mapValues, omit } from "lodash-es";
import { calculateRouteForLine } from "../routing/routing.js";
import { PadModel } from "./pad";
import { Point as GeoJsonPoint } from "geojson";
import { TypeModel } from "./type";

export type LineWithTrackPoints = Line & {
	trackPoints: TrackPoint[];
}

export interface LineModel extends Model<InferAttributes<LineModel>, InferCreationAttributes<LineModel>> {
	id: CreationOptional<ID>;
	padId: ForeignKey<PadModel["id"]>;
	routePoints: string;
	typeId: ForeignKey<TypeModel["id"]>;
	mode: CreationOptional<string>;
	colour: CreationOptional<string>;
	width: CreationOptional<number>;
	name: CreationOptional<string | null>;
	distance: CreationOptional<number | null>;
	time: CreationOptional<number | null>;
	ascent: CreationOptional<number | null>;
	descent: CreationOptional<number | null>;
	top: Latitude;
	bottom: Latitude;
	left: Longitude;
	right: Longitude;
	extraInfo: CreationOptional<string | null>;

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
					const routePoints = this.getDataValue("routePoints");
					return routePoints != null ? JSON.parse(routePoints) : routePoints;
				},
				set: function(this: LineModel, v: Point[]) {
					for(let i=0; i<v.length; i++) {
						v[i].lat = Number(v[i].lat.toFixed(6));
						v[i].lon = Number(v[i].lon.toFixed(6));
					}
					this.setDataValue("routePoints", JSON.stringify(v));
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
			mode : { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
			colour : { type: DataTypes.STRING(6), allowNull: false, defaultValue: "0000ff", validate: validateColour },
			width : { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 4, validate: { min: 1 } },
			name : { type: DataTypes.TEXT, allowNull: true, get: function(this: LineModel) { return this.getDataValue("name") || "Untitled line"; } },
			distance : { type: DataTypes.FLOAT(24, 2).UNSIGNED, allowNull: true },
			time : { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
			ascent : { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
			descent : { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
			top: getLatType(),
			bottom: getLatType(),
			left: getLonType(),
			right: getLonType(),
			extraInfo: {
				type: DataTypes.TEXT,
				allowNull: true,
				get: function(this: LineModel) {
					const extraInfo = this.getDataValue("extraInfo");
					return extraInfo != null ? JSON.parse(extraInfo) : extraInfo;
				},
				set: function(this: LineModel, v: ExtraInfo) {
					this.setDataValue("extraInfo", JSON.stringify(v));
				}
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
			ele: { type: DataTypes.INTEGER, allowNull: true }
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

	getPadLines(padId: PadId, fields?: Array<keyof Line>): AsyncGenerator<Line, void, void> {
		const cond = fields ? { attributes: fields } : { };
		return this._db.helpers._getPadObjects<Line>("Line", padId, cond);
	}

	getPadLinesByType(padId: PadId, typeId: ID): AsyncGenerator<Line, void, void> {
		return this._db.helpers._getPadObjects<Line>("Line", padId, { where: { typeId: typeId } });
	}

	async* getPadLinesWithPoints(padId: PadId): AsyncGenerator<LineWithTrackPoints, void, void> {
		for await (const line of this.getPadLines(padId)) {
			const trackPoints = await this.getAllLinePoints(line.id);
			yield { ...line, trackPoints };
		}
	}

	async getLineTemplate(padId: PadId, data: { typeId: ID }): Promise<Line> {
		const lineTemplate = {
			...this.LineModel.build({ ...data, padId: padId } satisfies Partial<CreationAttributes<LineModel>> as any).toJSON(),
			data: { }
		} as Line;

		const type = await this._db.types.getType(padId, data.typeId);

		if(type.defaultColour)
			lineTemplate.colour = type.defaultColour;
		if(type.defaultWidth)
			lineTemplate.width = type.defaultWidth;
		if(type.defaultMode)
			lineTemplate.mode = type.defaultMode;

		await this._db.helpers._updateObjectStyles(lineTemplate);

		return lineTemplate;
	}

	getLine(padId: PadId, lineId: ID): Promise<Line> {
		return this._db.helpers._getPadObject<Line>("Line", padId, lineId);
	}

	async createLine(padId: PadId, data: LineCreate, trackPointsFromRoute?: Route): Promise<Line> {
		const type = await this._db.types.getType(padId, data.typeId);

		if(type.defaultColour && !data.colour)
			data.colour = type.defaultColour;
		if(type.defaultWidth && !data.width)
			data.width = type.defaultWidth;
		if(type.defaultMode && !data.mode)
			data.mode = type.defaultMode;

		const { trackPoints, ...routeInfo } = await calculateRouteForLine(data, trackPointsFromRoute);

		const dataCopy = { ...data, ...routeInfo };
		delete dataCopy.trackPoints; // They came if mode is track

		const createdLine = await this._db.helpers._createPadObject<Line>("Line", padId, dataCopy);
		await this._db.helpers._updateObjectStyles(createdLine);

		// We have to emit this before calling _setLinePoints so that this event is sent to the client first
		this._db.emit("line", padId, createdLine);

		await this._setLinePoints(padId, createdLine.id, trackPoints);

		return createdLine;
	}

	async updateLine(padId: PadId, lineId: ID, data: LineUpdate, doNotUpdateStyles?: boolean, trackPointsFromRoute?: Route): Promise<Line> {
		const originalLine = await this.getLine(padId, lineId);
		const update = {
			...data,
			routePoints: data.routePoints || originalLine.routePoints,
			mode: (data.mode ?? originalLine.mode) || ""
		};

		let routeInfo;
		if((update.mode == "track" && update.trackPoints) || !isEqual(update.routePoints, originalLine.routePoints) || update.mode != originalLine.mode)
			routeInfo = await calculateRouteForLine(update, trackPointsFromRoute);

		Object.assign(update, mapValues(routeInfo, (val) => val == null ? null : val)); // Use null instead of undefined
		delete update.trackPoints; // They came if mode is track

		const newLine = await this._db.helpers._updatePadObject<Line>("Line", padId, lineId, update, doNotUpdateStyles);

		if(!doNotUpdateStyles)
			await this._db.helpers._updateObjectStyles(newLine); // Modifies newLine

		this._db.emit("line", padId, newLine);

		if(routeInfo)
			await this._setLinePoints(padId, lineId, routeInfo.trackPoints);

		return newLine;
	}

	async _setLinePoints(padId: PadId, lineId: ID, trackPoints: Point[], _noEvent?: boolean): Promise<void> {
		// First get elevation, so that if that fails, we don't update anything
		await this.LinePointModel.destroy({ where: { lineId: lineId } });

		const create = [ ];
		for(let i=0; i<trackPoints.length; i++) {
			create.push({ ...trackPoints[i], lineId: lineId });
		}

		const points = await this._db.helpers._bulkCreateInBatches<TrackPoint>(this.LinePointModel, create);

		if(!_noEvent)
			this._db.emit("linePoints", padId, lineId, points.map((point) => omit(point, ["lineId", "pos"]) as TrackPoint));
	}

	async deleteLine(padId: PadId, lineId: ID): Promise<Line> {
		await this._setLinePoints(padId, lineId, [ ], true);
		const oldLine = await this._db.helpers._deletePadObject<Line>("Line", padId, lineId);
		this._db.emit("deleteLine", padId, { id: lineId });
		return oldLine;
	}

	async* getLinePointsForPad(padId: PadId, bboxWithZoom: BboxWithZoom & BboxWithExcept): AsyncGenerator<{ id: ID; trackPoints: TrackPoint[] }, void, void> {
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
						makeBboxCondition(bboxWithZoom)
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

	async getAllLinePoints(lineId: ID): Promise<TrackPoint[]> {
		const points = await this.LineModel.build({ id: lineId } satisfies Partial<CreationAttributes<LineModel>> as any).getLinePoints({
			attributes: [ "pos", "lat", "lon", "ele", "zoom", "idx" ],
			order: [["idx", "ASC"]]
		});
		return points.map((point) => omit(point.toJSON(), ["pos"]) as TrackPoint);
	}

}