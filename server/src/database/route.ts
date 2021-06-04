import { generateRandomId } from "../utils/utils";
import { DataTypes, Model, Op } from "sequelize";
import Database from "./database";
import { BboxWithZoom, ID, Latitude, Longitude, PadId, Point, Route, RouteMode, TrackPoint } from "facilmap-types";
import { BboxWithExcept, getPosType, getVirtualLatType, getVirtualLonType, makeBboxCondition } from "./helpers";
import { WhereOptions } from "sequelize/types/lib/model";
import { calculateRouteForLine } from "../routing/routing";
import { omit } from "lodash";

const updateTimes: Record<string, number> = {};

function createRoutePointModel() {
	return class RoutePointModel extends Model {
		routeId!: string;
		lat!: Latitude;
		lon!: Longitude;
		zoom!: number;
		idx!: number;
		ele!: number | null;
		toJSON!: () => TrackPoint;
	};
}

export interface RouteWithId extends Route {
	id: string;
}

export default class DatabaseRoutes {

	RoutePointModel = createRoutePointModel();

	_db: Database;

	constructor(database: Database) {
		this._db = database;

		this.RoutePointModel.init({
			routeId: { type: DataTypes.STRING, allowNull: false },
			lat: getVirtualLatType(),
			lon: getVirtualLonType(),
			pos: getPosType(),
			zoom: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, validate: { min: 1, max: 20 } },
			idx: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			ele: { type: DataTypes.INTEGER, allowNull: true }
		}, {
			sequelize: this._db._conn,
			indexes: [
				{ fields: [ "routeId", "zoom" ] }
				// pos index is created in migration
			],
			modelName: "RoutePoint"
		});
	}

	async getRoutePoints(routeId: string, bboxWithZoom?: BboxWithZoom & BboxWithExcept, getCompleteBasicRoute = false): Promise<TrackPoint[]> {
		const cond: WhereOptions = {
			routeId,
			...(!bboxWithZoom ? {} : {
				[Op.or]: [
					{ [Op.and]: [ makeBboxCondition(bboxWithZoom), { zoom: { [Op.lte]: bboxWithZoom.zoom } } ] },
					...(!getCompleteBasicRoute ? [] : [
						{ zoom: { [Op.lte]: 5 } }
					])
				]
			})
		};

		return (await this.RoutePointModel.findAll({
			where: cond,
			attributes: [ "pos", "lat", "lon", "idx", "ele"],
			order: [[ "idx", "ASC" ]]
		})).map((point) => omit(point.toJSON(), ["pos"]) as TrackPoint);
	}

	async generateRouteId(): Promise<string> {
		// TODO: Check if exists
		return generateRandomId(20);
	}

	async createRoute(routePoints: Point[], mode: RouteMode): Promise<RouteWithId | undefined> {
		const routeId = await this.generateRouteId();
		return await this.updateRoute(routeId, routePoints, mode, true);
	}

	async updateRoute(routeId: string, routePoints: Point[], mode: RouteMode, _noClear = false): Promise<RouteWithId | undefined> {
		const thisTime = Date.now();
		updateTimes[routeId] = thisTime;

		const routeInfoP = calculateRouteForLine({ mode, routePoints });
		routeInfoP.catch(() => null); // Avoid unhandled promise error (https://stackoverflow.com/a/59062117/242365)

		if(!_noClear)
			await this.deleteRoute(routeId, true);

		if(thisTime != updateTimes[routeId])
			return;

		await this.RoutePointModel.destroy({
			where: { routeId }
		});

		if(thisTime != updateTimes[routeId])
			return;

		const routeInfo = await routeInfoP;

		if(thisTime != updateTimes[routeId])
			return;

		const create = [ ];
		for(const trackPoint of routeInfo.trackPoints) {
			create.push({ ...trackPoint, routeId: routeId });
		}

		await this._db.helpers._bulkCreateInBatches(this.RoutePointModel, create);

		if(thisTime != updateTimes[routeId])
			return;

		return {
			id: routeId,
			routePoints,
			mode,
			...routeInfo
		};
	}

	async lineToRoute(routeId: string | undefined, padId: PadId, lineId: ID): Promise<RouteWithId | undefined> {
		const clear = !!routeId;

		if (!routeId)
			routeId = await this.generateRouteId();

		const thisTime = Date.now();
		updateTimes[routeId] = thisTime;

		if(clear) {
			await this.RoutePointModel.destroy({
				where: { routeId }
			});
		}

		if(thisTime != updateTimes[routeId])
			return;

		const line = await this._db.lines.getLine(padId, lineId);
		const linePoints = await this._db.lines.getAllLinePoints(lineId);

		if(thisTime != updateTimes[routeId])
			return;

		const create = [];
		for(const linePoint of linePoints) {
			create.push({
				routeId,
				lat: linePoint.lat,
				lon: linePoint.lon,
				ele: linePoint.ele,
				zoom: linePoint.zoom,
				idx: linePoint.idx
			});
		}

		await this._db.helpers._bulkCreateInBatches(this.RoutePointModel, create);

		if(thisTime != updateTimes[routeId])
			return;

		return {
			id: routeId,
			mode: line.mode,
			routePoints: line.routePoints,
			trackPoints: linePoints,
			distance: line.distance,
			time: line.time,
			ascent: line.ascent,
			descent: line.descent,
			extraInfo: line.extraInfo,
			top: line.top,
			left: line.left,
			bottom: line.bottom,
			right: line.right
		};
	}

	async deleteRoute(routeId: string, _noConcurrencyCheck = false): Promise<void> {
		if (!_noConcurrencyCheck)
			updateTimes[routeId] = Date.now();

		await this.RoutePointModel.destroy({
			where: {
				routeId
			}
		});
	}

	async getRoutePointsByIdx(routeId: string, indexes: number[]): Promise<TrackPoint[]> {
		const data = await this.RoutePointModel.findAll({
			where: { routeId, idx: indexes },
			attributes: [ "pos", "lat", "lon", "idx", "ele" ],
			order: [[ "idx", "ASC" ]]
		});
		return data.map((d) => omit(d.toJSON(), ["pos"]) as TrackPoint);
	}

	async getAllRoutePoints(routeId: string): Promise<TrackPoint[]> {
		const data = await this.RoutePointModel.findAll({
			where: {routeId},
			attributes: [ "pos", "lat", "lon", "idx", "ele", "zoom"]
		});
		return data.map((d) => omit(d.toJSON(), ["pos"]) as TrackPoint);
	}

}