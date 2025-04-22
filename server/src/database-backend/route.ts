import { generateRandomId } from "../utils/utils.js";
import { DataTypes, type InferAttributes, type InferCreationAttributes, Model, Op, type WhereOptions } from "sequelize";
import DatabaseBackend from "./database.js";
import type { BboxWithZoom, ID, Latitude, Longitude, Point, Route, RouteMode, TrackPoint } from "facilmap-types";
import { type BboxWithExcept, createModel, findAllStreamed, getPosType, getVirtualLatType, getVirtualLonType } from "./helpers.js";
import { calculateRouteForLine } from "../routing/routing.js";
import { omit } from "lodash-es";
import type { Point as GeoJsonPoint } from "geojson";
import { iterableToArray } from "../utils/streams.js";

const updateTimes: Record<string, number> = {};

interface RoutePointModel extends Model<InferAttributes<RoutePointModel>, InferCreationAttributes<RoutePointModel>> {
	routeId: string;
	lat: Latitude;
	lon: Longitude;
	pos: GeoJsonPoint;
	zoom: number;
	idx: number;
	ele: number | null;
	toJSON: () => TrackPoint;
}

export default class DatabaseRoutes {

	private RoutePointModel = createModel<RoutePointModel>();

	_db: DatabaseBackend;

	constructor(database: DatabaseBackend) {
		this._db = database;

		this.RoutePointModel.init({
			routeId: { type: DataTypes.STRING, allowNull: false },
			lat: getVirtualLatType(),
			lon: getVirtualLonType(),
			pos: getPosType(),
			zoom: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, validate: { min: 1, max: 20 } },
			idx: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			ele: {
				type: DataTypes.INTEGER,
				allowNull: true,
				set: function(this: RoutePointModel, v: number | null) {
					// Round number to avoid integer column error in Postgres
					this.setDataValue("ele", v != null ? Math.round(v) : v);
				}
			}
		}, {
			sequelize: this._db._conn,
			indexes: [
				{ fields: [ "routeId", "zoom" ] }
				// pos index is created in migration
			],
			modelName: "RoutePoint"
		});
	}

	async truncateRoutePoints(): Promise<void> {
		await this.RoutePointModel.truncate();
	}

	async getRoutePoints(routeId: string, bboxWithZoom?: BboxWithZoom & BboxWithExcept, getCompleteBasicRoute = false): Promise<TrackPoint[]> {
		const cond: WhereOptions = {
			routeId,
			...(!bboxWithZoom ? {} : {
				[Op.or]: [
					{ [Op.and]: [ this._db.helpers.makeBboxCondition(bboxWithZoom), { zoom: { [Op.lte]: bboxWithZoom.zoom } } ] },
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

	async createRoute(routePoints: Point[], mode: RouteMode): Promise<(Route & { routeId: string; trackPoints: TrackPoint[] }) | undefined> {
		const routeId = await this.generateRouteId();
		return await this.updateRoute(routeId, routePoints, mode, true);
	}

	async updateRoute(routeId: string, routePoints: Point[], mode: RouteMode, _noClear = false): Promise<(Route & { routeId: string; trackPoints: TrackPoint[] }) | undefined> {
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
			routeId,
			routePoints,
			mode,
			...routeInfo
		};
	}

	async lineToRoute(routeId: string | undefined, mapId: ID, lineId: ID): Promise<(Route & { routeId: string; trackPoints: TrackPoint[] }) | undefined> {
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

		const line = await this._db.lines.getLine(mapId, lineId);
		const linePointsIt = this._db.lines.getLinePointsForLine(lineId);
		const linePoints = await iterableToArray((async function*() {
			for await (const linePoint of linePointsIt) {
				yield {
					routeId,
					lat: linePoint.lat,
					lon: linePoint.lon,
					ele: linePoint.ele,
					zoom: linePoint.zoom,
					idx: linePoint.idx
				};
			}
		})());

		if(thisTime != updateTimes[routeId])
			return;

		await this._db.helpers._bulkCreateInBatches(this.RoutePointModel, linePoints);

		if(thisTime != updateTimes[routeId])
			return;

		return {
			routeId,
			mode: line.mode,
			routePoints: line.routePoints,
			trackPoints: linePoints,
			distance: line.distance,
			time: line.time ?? undefined,
			ascent: line.ascent ?? undefined,
			descent: line.descent ?? undefined,
			extraInfo: line.extraInfo ?? undefined,
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

	async* getAllRoutePoints(routeId: string): AsyncIterable<TrackPoint> {
		for await (const routePoint of findAllStreamed(this.RoutePointModel, {
			where: { routeId },
			attributes: [ /* Needed for findAllStreamed */ "id", "pos", "lat", "lon", "idx", "ele", "zoom"]
		})) {
			yield omit(routePoint.toJSON(), ["id", "pos"]) as TrackPoint;
		}
	}

}
