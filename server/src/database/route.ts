import { generateRandomId } from "../utils/utils";
import { DataTypes, Model, Op } from "sequelize";
import Database from "./database";
import { BboxWithZoom, ID, Latitude, Longitude, PadId, Point, Route, RouteMode, TrackPoint } from "../../../types/src";
import { BboxWithExcept, getLatType, getLonType, makeBboxCondition } from "./helpers";
import { WhereOptions } from "sequelize/types/lib/model";
import { calculateRouteForLine } from "../routing/routing";

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
			lat: getLatType(),
			lon: getLonType(),
			zoom: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, validate: { min: 1, max: 20 } },
			idx: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			ele: { type: DataTypes.INTEGER, allowNull: true }
		}, {
			sequelize: this._db._conn,
			indexes: [
				{ fields: [ "routeId" ] }
			]
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
			attributes: [ "lon", "lat", "idx", "ele"],
			order: [[ "idx", "ASC" ]]
		})).map((point) => point.toJSON());
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

		const routeInfoP = calculateRouteForLine({ mode, routePoints });

		if(!_noClear)
			await this.deleteRoute(routeId);

		if(thisTime < updateTimes[routeId])
			return;

		await this.RoutePointModel.destroy({
			where: { routeId }
		});

		if(thisTime < updateTimes[routeId])
			return;

		const routeInfo = await routeInfoP;

		if(thisTime < updateTimes[routeId])
			return;

		const create = [ ];
		for(const trackPoint of routeInfo.trackPoints) {
			create.push({ ...trackPoint, routeId: routeId });
		}

		await this._db.helpers._bulkCreateInBatches(this.RoutePointModel, create);

		if(thisTime < updateTimes[routeId])
			return;

		updateTimes[routeId] = thisTime;

		return {
			id: routeId,
			routePoints,
			mode,
			...routeInfo
		};
	}

	async lineToRoute(routeId: string | undefined, padId: PadId, lineId: ID): Promise<RouteWithId> {
		if(routeId) {
			await this.RoutePointModel.destroy({
				where: { routeId }
			});
		} else
			routeId = await this.generateRouteId();

		const line = await this._db.lines.getLine(padId, lineId);
		const linePoints = await this._db.lines.getAllLinePoints(lineId);

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

		updateTimes[routeId] = Date.now();

		return {
			id: routeId,
			mode: line.mode,
			routePoints: line.routePoints,
			trackPoints: linePoints,
			distance: line.distance,
			time: line.time,
			ascent: line.ascent,
			descent: line.descent,
			extraInfo: line.extraInfo
		};
	}

	async deleteRoute(routeId: string): Promise<void> {
		delete updateTimes[routeId];

		await this.RoutePointModel.destroy({
			where: {
				routeId
			}
		});
	}

	async getRoutePointsByIdx(routeId: string, indexes: number[]): Promise<TrackPoint[]> {
		const data = await this.RoutePointModel.findAll({
			where: { routeId, idx: indexes },
			attributes: [ "lon", "lat", "idx", "ele" ],
			order: [[ "idx", "ASC" ]]
		});
		return data.map((d) => d.toJSON());
	}

	async getAllRoutePoints(routeId: string): Promise<TrackPoint[]> {
		const data = await this.RoutePointModel.findAll({
			where: {routeId},
			attributes: [ "lon", "lat", "idx", "ele", "zoom"]
		});
		return data.map((d) => d.toJSON());
	}

}