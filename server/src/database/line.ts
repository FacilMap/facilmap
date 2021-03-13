import { DataTypes, HasManyGetAssociationsMixin, Model, Op } from "sequelize";
import { BboxWithZoom, ID, Latitude, Line, LineCreate, ExtraInfo, LineUpdate, Longitude, PadId, Point, Route, TrackPoint } from "../../../types/src";
import Database from "./database";
import { BboxWithExcept, dataDefinition, DataModel, getLatType, getLonType, makeBboxCondition, makeNotNullForeignKey, validateColour } from "./helpers";
import { isEqual } from "lodash";
import { wrapAsync } from "../utils/streams";
import { calculateRouteForLine } from "../routing/routing";

export type LineWithTrackPoints = Line & {
	trackPoints: Point[];
}

function createLineModel() {
	return class LineModel extends Model {
		id!: ID;
		padId!: PadId;
		routePoints!: string;
		mode!: string;
		colour!: string;
		width!: number;
		name!: string | null;
		distance!: number | null;
		time!: number | null;
		ascent!: number | null;
		descent!: number | null;
		top!: Latitude;
		bottom!: Latitude;
		left!: Longitude;
		right!: Longitude;
		extraInfo!: string | null;

		getLinePoints!: HasManyGetAssociationsMixin<LinePointModel>;
		toJSON!: () => Line;
	}
}

function createLinePointModel() {
	return class LinePointModel extends Model {
		id!: ID;
		lat!: Latitude;
		lon!: Longitude;
		zoom!: number;
		idx!: number;
		ele!: number | null;
		toJSON!: () => TrackPoint;
	};
}

function createLineDataModel() {
	return class LineData extends DataModel {};
}

export type LineModel = InstanceType<ReturnType<typeof createLineModel>>;
export type LinePointModel = InstanceType<ReturnType<typeof createLinePointModel>>;

export default class DatabaseLines {

	LineModel = createLineModel();
	LinePointModel = createLinePointModel();
	LineDataModel = createLineDataModel();

	_db: Database;

	constructor(database: Database) {
		this._db = database;

		this.LineModel.init({
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
			lat: getLatType(),
			lon: getLonType(),
			zoom: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, validate: { min: 1, max: 20 } },
			idx: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			ele: { type: DataTypes.INTEGER, allowNull: true }
		}, {
			sequelize: this._db._conn,
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

	getPadLines(padId: PadId, fields?: Array<keyof Line>): Highland.Stream<Line> {
		const cond = fields ? { attributes: fields } : { };
		return this._db.helpers._getPadObjects<Line>("Line", padId, cond);
	}

	getPadLinesByType(padId: PadId, typeId: ID): Highland.Stream<Line> {
		return this._db.helpers._getPadObjects<Line>("Line", padId, { where: { typeId: typeId } });
	}

	getPadLinesWithPoints(padId: PadId, bboxWithZoom?: BboxWithZoom): Highland.Stream<LineWithTrackPoints> {
		return this.getPadLines(padId)
			.flatMap(wrapAsync(async (line): Promise<LineWithTrackPoints> => {
				const trackPoints = await this.getLinePoints(line.id, bboxWithZoom);
				return { ...line, trackPoints };
			}));
	}

	async getLineTemplate(padId: PadId, data: { typeId: ID }): Promise<Line> {
		const lineTemplate = {
			...this.LineModel.build({ ...data, padId: padId }).toJSON(),
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
			mode: data.mode || originalLine.mode || ""
		};

		let routeInfo;
		if((update.mode == "track" && update.trackPoints) || !isEqual(update.routePoints, originalLine.routePoints) || update.mode != originalLine.mode)
			routeInfo = await calculateRouteForLine(update, trackPointsFromRoute);

		Object.assign(update, routeInfo);
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
			create.push(Object.assign(JSON.parse(JSON.stringify(trackPoints[i])), { lineId: lineId }));
		}

		const points = await this._db.helpers._bulkCreateInBatches<TrackPoint>(this.LinePointModel, create);

		if(!_noEvent)
			this._db.emit("linePoints", padId, lineId, points);
	}

	async deleteLine(padId: PadId, lineId: ID): Promise<Line> {
		await this._setLinePoints(padId, lineId, [ ], true);
		const oldLine = await this._db.helpers._deletePadObject<Line>("Line", padId, lineId);
		this._db.emit("deleteLine", padId, { id: lineId });
		return oldLine;
	}

	getLinePointsForPad(padId: PadId, bboxWithZoom: BboxWithZoom & BboxWithExcept): Highland.Stream<{ id: ID; trackPoints: TrackPoint[] }> {
		return this.getPadLines(padId, [ "id" ])
			.flatMap(wrapAsync(async (line): Promise<{ id: ID, trackPoints: TrackPoint[] } | undefined> => {
				const trackPoints = await this.getLinePoints(line.id, bboxWithZoom);
				if(trackPoints.length >= 2)
					return { id: line.id, trackPoints: trackPoints };
			}))
			.filter((obj) => obj != null) as Highland.Stream<{ id: ID, trackPoints: TrackPoint[] }>;
	}

	async getLinePoints(lineId: ID, bboxWithZoom?: BboxWithZoom & BboxWithExcept): Promise<TrackPoint[]> {
		const data = await this.LineModel.build({ id: lineId }).getLinePoints({
			where: {
				[Op.and]: [
					makeBboxCondition(bboxWithZoom),
					...(bboxWithZoom ? [ { zoom: { [Op.lte]: bboxWithZoom.zoom } } ] : [])
				]
			},
			attributes: [ "idx" ],
			order: [[ "idx", "ASC" ]]
		});

		// Get one more point outside of the bbox for each segment
		const indexes = [ ];
		for(let i=0; i<data.length; i++) {
			if(i == 0 || data[i-1].idx != data[i].idx-1) // Beginning of segment
				indexes.push(data[i].idx-1);

			indexes.push(data[i].idx);

			if(i == data.length-1 || data[i+1].idx != data[i].idx+1) // End of segment
				indexes.push(data[i].idx+1);
		}

		if(indexes.length == 0)
			return [ ];

		return this.getLinePointsByIdx(lineId, indexes);
	}

	async getLinePointsByIdx(lineId: ID, indexes: number[]): Promise<TrackPoint[]> {
		const data = await this.LineModel.build({ id: lineId }).getLinePoints({
			where: { idx: indexes },
			attributes: [ "lon", "lat", "idx", "ele" ],
			order: [[ "idx", "ASC" ]]
		});
		return data.map((point) => point.toJSON() as TrackPoint);
	}

	async getAllLinePoints(lineId: ID): Promise<TrackPoint[]> {
		const points = await this.LineModel.build({ id: lineId }).getLinePoints({
			attributes: [ "lat", "lon", "ele", "zoom", "idx" ]
		});
		return points.map((point) => point.toJSON() as TrackPoint);
	}

}