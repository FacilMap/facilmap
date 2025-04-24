import { generateRandomId } from "../utils/utils.js";
import Database from "./database.js";
import type { BboxWithExcept, BboxWithZoom, ID, Point, Route, RouteMode, TrackPoint } from "facilmap-types";
import { calculateRouteForLine } from "../routing/routing.js";
import { iterableToArray } from "../utils/streams.js";
import type DatabaseRoutesBackend from "../database-backend/route.js";

const routeAbort: Record<string, AbortController> = {};

export default class DatabaseRoutes {

	protected db: Database;
	protected backend: DatabaseRoutesBackend;

	constructor(database: Database) {
		this.db = database;
		this.backend = database.backend.routes;
	}

	async getRoutePoints(routeId: string, bboxWithZoom?: BboxWithZoom & BboxWithExcept, getCompleteBasicRoute = false): Promise<TrackPoint[]> {
		return await this.backend.getRoutePoints(routeId, bboxWithZoom, getCompleteBasicRoute);
	}

	async generateRouteId(): Promise<string> {
		// TODO: Check if exists
		return generateRandomId(20);
	}

	async createRoute(routePoints: Point[], mode: RouteMode): Promise<(Route & { routeId: string; trackPoints: TrackPoint[] })> {
		const routeId = await this.generateRouteId();
		return await this.updateRoute(routeId, routePoints, mode, true);
	}

	async updateRoute(routeId: string, routePoints: Point[], mode: RouteMode, _noClear = false): Promise<(Route & { routeId: string; trackPoints: TrackPoint[] })> {
		routeAbort[routeId]?.abort();
		const abort = routeAbort[routeId] = new AbortController();

		try {
			const routeInfo = await calculateRouteForLine({ mode, routePoints });

			abort.signal.throwIfAborted();

			await this.backend.setRoutePoints(routeId, routeInfo.trackPoints, { noClear: _noClear, signal: abort.signal });

			abort.signal.throwIfAborted();

			return {
				routeId,
				routePoints,
				mode,
				...routeInfo
			};
		} finally {
			if (routeAbort[routeId] === abort) {
				delete routeAbort[routeId];
			}
		}
	}

	async lineToRoute(routeId: string | undefined, mapId: ID, lineId: ID): Promise<(Route & { routeId: string; trackPoints: TrackPoint[] })> {
		const noClear = !routeId;

		if (!routeId)
			routeId = await this.generateRouteId();

		routeAbort[routeId]?.abort();
		const abort = routeAbort[routeId] = new AbortController();

		const [line, linePoints] = await Promise.all([
			await this.db.lines.getLine(mapId, lineId),
			iterableToArray((async function*(this: DatabaseRoutes) {
				for await (const linePoint of this.db.lines.getLinePointsForLine(lineId)) {
					yield {
						routeId,
						lat: linePoint.lat,
						lon: linePoint.lon,
						ele: linePoint.ele,
						zoom: linePoint.zoom,
						idx: linePoint.idx
					};
				}
			}).call(this))
		]);

		abort.signal.throwIfAborted();

		await this.backend.setRoutePoints(routeId, linePoints, { noClear, signal: abort.signal });

		abort.signal.throwIfAborted();

		return {
			routeId,
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

	async deleteRoute(routeId: string): Promise<void> {
		routeAbort[routeId]?.abort();
		await this.backend.deleteRoute(routeId);
	}

	async getRoutePointsByIdx(routeId: string, indexes: number[]): Promise<TrackPoint[]> {
		return await this.backend.getRoutePointsByIdx(routeId, indexes);
	}

	getAllRoutePoints(routeId: string): AsyncIterable<TrackPoint> {
		return this.backend.getAllRoutePoints(routeId);
	}

}
