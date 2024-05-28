import { ApiVersion, CRU, DEFAULT_PAGING, Writable, allMapObjectsPickValidator, bboxWithExceptValidator, bboxWithZoomValidator, exportFormatValidator, lineValidator, mapDataValidator, markerValidator, pagingValidator, pointValidator, routeModeValidator, stringifiedBooleanValidator, stringifiedIdValidator, typeValidator, viewValidator, type AllAdminMapObjectsItem, type AllMapObjectsItem, type AllMapObjectsPick, type AllMapObjectsTypes, type Api, type Bbox, type BboxWithExcept, type BboxWithZoom, type ExportFormat, type FindMapsResult, type FindOnMapResult, type HistoryEntry, type ID, type Line, type LinePoints, type LineWithTrackPoints, type MapData, type MapDataWithWritable, type MapSlug, type Marker, type PagedResults, type ReplaceProperties, type Route, type RouteInfo, type RouteRequest, type SearchResult, type StreamedResults, type TrackPoint, type Type, type View } from "facilmap-types";
import * as z from "zod";
import type Database from "../database/database";
import { getI18n } from "../i18n";
import { apiImpl, stringArrayValidator, stringifiedJsonValidator, type ApiImpl } from "./api-common";
import { getSafeFilename, normalizeLineName } from "facilmap-utils";
import { exportLineToTrackGpx, exportLineToRouteGpx } from "../export/gpx";
import { geoipLookup } from "../geoip";
import { calculateRoute } from "../routing/routing";
import { findQuery, findUrl } from "../search";
import { iterableToArray, mapAsyncIterable, writableToWeb } from "../utils/streams";
import { arrayStream, stringifyJsonStream, objectStream, type SerializableJsonValue } from "json-stream-es";

export class ApiV3Backend implements Api<ApiVersion.V3, true> {
	protected database: Database;
	protected remoteAddr: string | undefined;

	constructor(database: Database, remoteAddr: string | undefined) {
		this.database = database;
		this.remoteAddr = remoteAddr;
	}

	protected async resolveMapSlug(mapSlug: MapSlug, minimumPermissions: Writable): Promise<MapDataWithWritable> {
		return await this.database.maps.getMapDataBySlug(mapSlug, minimumPermissions);
	}

	protected async* getMapObjectsUntyped<M extends MapDataWithWritable = MapDataWithWritable>(
		mapData: M,
		{ pick, bbox }: { pick: AllMapObjectsPick[]; bbox?: BboxWithZoom }
	): AsyncIterable<ReplaceProperties<AllMapObjectsTypes, { mapData: { type: "mapData", data: M } }>[AllMapObjectsPick]> {
		if (pick.includes("mapData")) {
			yield { type: "mapData", data: mapData };
		}

		if (pick.includes("types")) {
			yield { type: "types", data: this._getMapTypes(mapData) };
		}

		if (pick.includes("views")) {
			yield { type: "views", data: this._getMapViews(mapData) };
		}

		if (pick.includes("markers")) {
			yield { type: "markers", data: this._getMapMarkers(mapData, { bbox }) };
		}

		if (pick.includes("lines") || pick.includes("linesWithTrackPoints")) {
			yield { type: "lines", data: this._getMapLines(mapData, { includeTrackPoints: pick.includes("linesWithTrackPoints"), bbox }) };
		}

		if (pick.includes("linePoints")) {
			yield { type: "linePoints", data: this._getMapLinePoints(mapData, { bbox }) };
		}
	}

	protected getMapObjects<Pick extends AllMapObjectsPick, M extends MapDataWithWritable = MapDataWithWritable>(
		mapData: M,
		{ pick, bbox }: { pick: Pick[]; bbox?: BboxWithZoom }
	): AsyncIterable<ReplaceProperties<AllMapObjectsTypes, { mapData: { type: "mapData", data: M } }>[Pick]> {
		return this.getMapObjectsUntyped(mapData, { pick: pick as AllMapObjectsPick[], bbox }) as AsyncIterable<ReplaceProperties<AllMapObjectsTypes, { mapData: { type: "mapData", data: M } }>[Pick]>;
	}

	async findMaps(query: string, paging = DEFAULT_PAGING): Promise<PagedResults<FindMapsResult>> {
		return await this.database.maps.findMaps(query, paging);
	}

	async getMap(mapSlug: string): Promise<MapDataWithWritable> {
		return await this.resolveMapSlug(mapSlug, Writable.READ);
	}

	async createMap<Pick extends AllMapObjectsPick = "mapData" | "types">(data: MapData<CRU.CREATE_VALIDATED>, options?: { pick?: Pick[]; bbox?: BboxWithZoom }): Promise<AsyncIterable<AllAdminMapObjectsItem<Pick>>> {
		const mapData = await this.database.maps.createMap(data);
		return this.getMapObjects({ ...mapData, writable: Writable.ADMIN }, { ...options, pick: options?.pick ?? ["mapData", "types"] as Pick[] });
	}

	async updateMap(mapSlug: MapSlug, data: MapData<CRU.UPDATE_VALIDATED>): Promise<MapDataWithWritable> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);

		return {
			...await this.database.maps.updateMapData(mapData.id, data),
			writable: mapData.writable
		};
	}

	async deleteMap(mapSlug: MapSlug): Promise<void> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		await this.database.maps.deleteMap(mapData.id);
	}

	async getAllMapObjects<Pick extends AllMapObjectsPick = "mapData" | "markers" | "lines" | "linePoints" | "types" | "views">(mapSlug: MapSlug, options?: { pick?: Pick[]; bbox?: BboxWithZoom }): Promise<AsyncIterable<AllMapObjectsItem<Pick>>> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return this.getMapObjects(mapData, {
			...options,
			pick: options?.pick ?? ["mapData", "lines", "types", "views", ...options?.bbox ? ["markers", "linePoints"] : []] as Pick[]
		});
	}

	async findOnMap(mapSlug: MapSlug, query: string): Promise<FindOnMapResult[]> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return await this.database.search.search(mapData.id, query);
	}

	async getHistory(mapSlug: MapSlug, paging = DEFAULT_PAGING): Promise<HistoryEntry[]> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);

		return await iterableToArray(this.database.history.getHistory(mapData.id, mapData.writable === Writable.ADMIN ? undefined : ["Marker", "Line"], paging));
	}

	async revertHistoryEntry(mapSlug: MapSlug, historyEntryId: ID): Promise<void> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);

		const historyEntry = await this.database.history.getHistoryEntry(mapData.id, historyEntryId, { notFound404: true });

		if(!["Marker", "Line"].includes(historyEntry.type) && mapData.writable != Writable.ADMIN)
			throw new Error(getI18n().t("api.admin-revert-error"));

		await this.database.history.revertHistoryEntry(mapData.id, historyEntryId);
	}

	protected _getMapMarkers(mapData: MapDataWithWritable, options?: { bbox?: BboxWithExcept; typeId?: ID }): AsyncIterable<Marker> {
		if (options?.typeId) {
			return this.database.markers.getMapMarkersByType(mapData.id, options.typeId, options?.bbox);
		} else {
			return this.database.markers.getMapMarkers(mapData.id, options?.bbox);
		}
	}

	async getMapMarkers(mapSlug: MapSlug, options?: { bbox?: BboxWithExcept; typeId?: ID }): Promise<StreamedResults<Marker>> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);

		return {
			results: this._getMapMarkers(mapData, options)
		};
	}

	async getMarker(mapSlug: MapSlug, markerId: ID): Promise<Marker> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return await this.database.markers.getMarker(mapData.id, markerId, { notFound404: true });
	}

	async createMarker(mapSlug: MapSlug, data: Marker<CRU.CREATE_VALIDATED>): Promise<Marker> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);
		return await this.database.markers.createMarker(mapData.id, data);
	}

	async updateMarker(mapSlug: MapSlug, markerId: ID, data: Marker<CRU.UPDATE_VALIDATED>): Promise<Marker> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);
		return await this.database.markers.updateMarker(mapData.id, markerId, data, { notFound404: true });
	}

	async deleteMarker(mapSlug: MapSlug, markerId: ID): Promise<void> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);
		await this.database.markers.deleteMarker(mapData.id, markerId, { notFound404: true });
	}

	async* _getMapLines<IncludeTrackPoints extends boolean = false>(mapData: MapDataWithWritable, options?: { bbox?: BboxWithZoom; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }): AsyncIterable<IncludeTrackPoints extends true ? LineWithTrackPoints : Line> {
		for await (const line of options?.typeId ? this.database.lines.getMapLinesByType(mapData.id, options.typeId) : this.database.lines.getMapLines(mapData.id)) {
			if (options?.includeTrackPoints) {
				const trackPoints = await iterableToArray(this.database.lines.getLinePointsForLine(line.id, options?.bbox));
				yield { ...line, trackPoints } as LineWithTrackPoints;
			} else {
				yield line as IncludeTrackPoints extends true ? LineWithTrackPoints : Line;
			}
		}
	}

	_getMapLinePoints(mapData: MapDataWithWritable, options?: { bbox?: BboxWithZoom }): AsyncIterable<LinePoints> {
		return this.database.lines.getLinePointsForMap(mapData.id, options?.bbox);
	}

	async getMapLines<IncludeTrackPoints extends boolean = false>(mapSlug: MapSlug, options?: { bbox?: BboxWithZoom; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }): Promise<StreamedResults<IncludeTrackPoints extends true ? LineWithTrackPoints : Line>> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return {
			results: this._getMapLines(mapData, options)
		};
	}

	async getLine(mapSlug: MapSlug, lineId: ID): Promise<Line> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return await this.database.lines.getLine(mapData.id, lineId, { notFound404: true });
	}

	async getLinePoints(mapSlug: MapSlug, lineId: ID, options?: { bbox?: BboxWithZoom }): Promise<StreamedResults<TrackPoint>> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		const line = await this.database.lines.getLine(mapData.id, lineId, { notFound404: true });
		return {
			results: this.database.lines.getLinePointsForLine(line.id, options?.bbox)
		};
	}

	async createLine(mapSlug: MapSlug, data: Line<CRU.CREATE_VALIDATED>, trackPointsFromRoute?: Route): Promise<Line> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);
		return await this.database.lines.createLine(mapData.id, data, trackPointsFromRoute);
	}

	async updateLine(mapSlug: MapSlug, lineId: ID, data: Line<CRU.UPDATE_VALIDATED>, trackPointsFromRoute?: Route): Promise<Line> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);
		return await this.database.lines.updateLine(mapData.id, lineId, data, { notFound404: true, trackPointsFromRoute });
	}

	async deleteLine(mapSlug: MapSlug, lineId: ID): Promise<void> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);
		await this.database.lines.deleteLine(mapData.id, lineId, { notFound404: true });
	}

	async exportLine(mapSlug: MapSlug, lineId: ID, options: { format: ExportFormat }): Promise<{ type: string; filename: string; data: ReadableStream<string> }> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);

		const lineP = this.database.lines.getLine(mapData.id, lineId, { notFound404: true });
		lineP.catch(() => null); // Avoid unhandled promise error (https://stackoverflow.com/a/59062117/242365)

		const [line, type] = await Promise.all([
			lineP,
			lineP.then((line) => this.database.types.getType(mapData.id, line.typeId))
		]);

		const filename = getSafeFilename(normalizeLineName(line.name));

		switch(options.format) {
			case "gpx-trk":
				return {
					type: "application/gpx+xml",
					filename: `${filename}.gpx`,
					data: exportLineToTrackGpx(line, type, this.database.lines.getLinePointsForLine(line.id))
				};
			case "gpx-rte":
				return {
					type: "application/gpx+xml",
					filename: `${filename}.gpx`,
					data: exportLineToRouteGpx(line, type)
				};
			default:
				throw new Error(getI18n().t("api.unknown-format-error"));
		}
	}

	_getMapTypes(mapData: MapDataWithWritable): AsyncIterable<Type> {
		return this.database.types.getTypes(mapData.id);
	}

	async getMapTypes(mapSlug: MapSlug): Promise<StreamedResults<Type>> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return {
			results: this._getMapTypes(mapData)
		};
	}

	async getType(mapSlug: MapSlug, typeId: ID): Promise<Type> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return await this.database.types.getType(mapData.id, typeId, { notFound404: true });
	}

	async createType(mapSlug: MapSlug, data: Type<CRU.CREATE_VALIDATED>): Promise<Type> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		return await this.database.types.createType(mapData.id, data);
	}

	async updateType(mapSlug: MapSlug, typeId: ID, data: Type<CRU.UPDATE_VALIDATED>): Promise<Type> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		return await this.database.types.updateType(mapData.id, typeId, data, { notFound404: true });
	}

	async deleteType(mapSlug: MapSlug, typeId: ID): Promise<void> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		await this.database.types.deleteType(mapData.id, typeId, { notFound404: true });
	}

	_getMapViews(mapData: MapDataWithWritable): AsyncIterable<View> {
		return this.database.views.getViews(mapData.id);
	}

	async getMapViews(mapSlug: MapSlug): Promise<StreamedResults<View>> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return {
			results: this._getMapViews(mapData)
		};
	}

	async getView(mapSlug: MapSlug, viewId: ID): Promise<View> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return await this.database.views.getView(mapData.id, viewId, { notFound404: true });
	}

	async createView(mapSlug: MapSlug, data: View<CRU.CREATE_VALIDATED>): Promise<View> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		return await this.database.views.createView(mapData.id, data);
	}

	async updateView(mapSlug: MapSlug, viewId: ID, data: View<CRU.UPDATE_VALIDATED>): Promise<View> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		return await this.database.views.updateView(mapData.id, viewId, data, { notFound404: true });
	}

	async deleteView(mapSlug: MapSlug, viewId: ID): Promise<void> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		await this.database.views.deleteView(mapData.id, viewId, { notFound404: true });
	}

	async find(query: string): Promise<SearchResult[]> {
		return await findQuery(query);
	}

	async findUrl(url: string): Promise<{ data: ReadableStream<string> }> {
		const result = await findUrl(url);
		return { data: result.data };
	}

	async getRoute(data: RouteRequest): Promise<RouteInfo> {
		return await calculateRoute(data.destinations, data.mode);
	}

	async geoip(): Promise<Bbox | undefined> {
		return this.remoteAddr ? await geoipLookup(this.remoteAddr) : undefined;
	}
}



// Declaring the API this way is a bit awkward compared to setting up an Express router directly, but it has the advantage
// that we can be sure to not forget an API method and that we have type safety for the return value.
export const apiV3Impl: ApiImpl<ApiVersion.V3> = {
	findMaps: apiImpl.get("/map", (req) => {
		const { query, ...paging } = pagingValidator.extend({
			query: z.string()
		}).parse(req.query);
		return [query, paging];
	}, "json"),

	getMap: apiImpl.get("/map/:mapSlug", (req) => [req.params.mapSlug], "json"),

	createMap: apiImpl.post("/map", (req) => {
		const { pick, bbox } = z.object({
			pick: z.array(allMapObjectsPickValidator).optional(),
			bbox: bboxWithZoomValidator.optional()
		}).parse(req.query);
		return [mapDataValidator.create.parse(req.body), { pick, bbox }];
	}, (res, result) => {
		stringifyJsonStream(objectStream<SerializableJsonValue>(mapAsyncIterable(result, (obj) => {
			if (obj.type === "mapData") {
				return [obj.type, obj.data];
			} else {
				return [obj.type, arrayStream<SerializableJsonValue>(obj.data)];
			}
		}))).pipeTo(writableToWeb(res)).catch(() => undefined);
	}),

	updateMap: apiImpl.put("/map/:mapSlug", (req) => [req.params.mapSlug, mapDataValidator.update.parse(req.body)], "json"),

	deleteMap: apiImpl.del("/map/:mapSlug", (req) => [req.params.mapSlug], "empty"),

	getAllMapObjects: apiImpl.get("/map/:mapSlug/all", (req) => {
		const { pick, bbox } = z.object({
			pick: stringArrayValidator.pipe(z.array(allMapObjectsPickValidator)).optional(),
			bbox: stringifiedJsonValidator.pipe(bboxWithZoomValidator).optional()
		}).parse(req.query);
		return [req.params.mapSlug, { pick, bbox }];
	}, (res, result) => {
		stringifyJsonStream(objectStream<SerializableJsonValue>(mapAsyncIterable(result, (obj) => {
			if (obj.type === "mapData") {
				return [obj.type, obj.data];
			} else {
				return [obj.type, arrayStream<SerializableJsonValue>(obj.data)];
			}
		}))).pipeTo(writableToWeb(res)).catch(() => undefined);
	}),

	findOnMap: apiImpl.get("/map/:mapSlug/find", (req) => {
		const { query } = z.object({
			query: z.string()
		}).parse(req.query);
		return [req.params.mapSlug, query];
	}, "json"),

	getHistory: apiImpl.get("/map/:mapSlug/history", (req) => {
		const paging = pagingValidator.parse(req.query);
		return [req.params.mapSlug, paging];
	}, "json"),

	revertHistoryEntry: apiImpl.post("/map/:mapSlug/history/:historyEntryId/revert", (req) => {
		const historyEntryId = stringifiedIdValidator.parse(req.params.historyEntryId);
		return [req.params.mapSlug, historyEntryId];
	}, "empty"),

	getMapMarkers: apiImpl.get("/map/:mapSlug/marker", (req) => {
		const { bbox, typeId } = z.object({
			bbox: stringifiedJsonValidator.pipe(bboxWithExceptValidator).optional(),
			typeId: stringifiedIdValidator.optional()
		}).parse(req.query);
		return [req.params.mapSlug, { bbox, typeId }];
	}, "stream"),

	getMarker: apiImpl.get("/map/:mapSlug/marker/:markerId", (req) => {
		const markerId = stringifiedIdValidator.parse(req.params.markerId);
		return [req.params.mapSlug, markerId];
	}, "json"),

	createMarker: apiImpl.post("/map/:mapSlug/marker", (req) => [req.params.mapSlug, markerValidator.create.parse(req.body)], "json"),

	updateMarker: apiImpl.put("/map/:mapSlug/marker/:markerId", (req) => {
		const markerId = stringifiedIdValidator.parse(req.params.markerId);
		const data = markerValidator.update.parse(req.body);
		return [req.params.mapSlug, markerId, data];
	}, "json"),

	deleteMarker: apiImpl.del("/map/:mapSlug/marker/:markerId", (req) => {
		const markerId = stringifiedIdValidator.parse(req.params.markerId);
		return [req.params.mapSlug, markerId];
	}, "empty"),

	getMapLines: apiImpl.get("/map/:mapSlug/line", (req) => {
		const { bbox, includeTrackPoints, typeId } = z.object({
			bbox: stringifiedJsonValidator.pipe(bboxWithExceptValidator).optional(),
			includeTrackPoints: stringifiedBooleanValidator.optional(),
			typeId: stringifiedIdValidator.optional()
		}).parse(req.query);
		return [req.params.mapSlug, { bbox, includeTrackPoints, typeId }];
	}, "stream"),

	getLine: apiImpl.get("/map/:mapSlug/line/:lineId", (req) => {
		const lineId = stringifiedIdValidator.parse(req.params.lineId);
		return [req.params.mapSlug, lineId];
	}, "json"),

	getLinePoints: apiImpl.get("/map/:mapSlug/line/:lineId/linePoints", (req) => {
		const { bbox } = stringifiedJsonValidator.pipe(z.object({
			bbox: stringifiedJsonValidator.pipe(bboxWithExceptValidator)
		})).parse(req.query);
		const lineId = stringifiedIdValidator.parse(req.params.lineId);
		return [req.params.mapSlug, lineId, { bbox }];
	}, "stream"),

	createLine: apiImpl.post("/map/:mapSlug/line", (req) => [req.params.mapSlug, lineValidator.create.parse(req.body)], "json"),

	updateLine: apiImpl.put("/map/:mapSlug/line/:lineId", (req) => {
		const lineId = stringifiedIdValidator.parse(req.params.lineId);
		const data = lineValidator.update.parse(req.body);
		return [req.params.mapSlug, lineId, data];
	}, "json"),

	deleteLine: apiImpl.del("/map/:mapSlug/line/:lineId", (req) => {
		const lineId = stringifiedIdValidator.parse(req.params.lineId);
		return [req.params.mapSlug, lineId];
	}, "empty"),

	exportLine: apiImpl.get("/map/:mapSlug/line/:lineId/export", (req) => {
		const lineId = stringifiedIdValidator.parse(req.params.lineId);
		const { format } = z.object({
			format: exportFormatValidator
		}).parse(req.query);
		return [req.params.mapSlug, lineId, { format }];
	}, (res, result) => {
		res.set("Content-type", result.type);
		res.attachment(result.filename);
		void result.data.pipeTo(writableToWeb(res));
	}),

	getMapTypes: apiImpl.get("/map/:mapSlug/type", (req) => [req.params.mapSlug], "stream"),

	getType: apiImpl.get("/map/:mapSlug/type/:typeId", (req) => {
		const typeId = stringifiedIdValidator.parse(req.params.typeId);
		return [req.params.mapSlug, typeId];
	}, "json"),

	createType: apiImpl.post("/map/:mapSlug/type", (req) => [req.params.mapSlug, typeValidator.create.parse(req.body)], "json"),

	updateType: apiImpl.put("/map/:mapSlug/type/:typeId", (req) => {
		const typeId = stringifiedIdValidator.parse(req.params.typeId);
		const data = typeValidator.update.parse(req.body);
		return [req.params.mapSlug, typeId, data];
	}, "json"),

	deleteType: apiImpl.del("/map/:mapSlug/type/:typeId", (req) => {
		const typeId = stringifiedIdValidator.parse(req.params.typeId);
		return [req.params.mapSlug, typeId];
	}, "empty"),

	getMapViews: apiImpl.get("/map/:mapSlug/view", (req) => [req.params.mapSlug], "stream"),

	getView: apiImpl.get("/map/:mapSlug/view/:viewId", (req) => {
		const viewId = stringifiedIdValidator.parse(req.params.viewId);
		return [req.params.mapSlug, viewId];
	}, "json"),

	createView: apiImpl.post("/map/:mapSlug/view", (req) => [req.params.mapSlug, viewValidator.create.parse(req.body)], "json"),

	updateView: apiImpl.put("/map/:mapSlug/view/:viewId", (req) => {
		const viewId = stringifiedIdValidator.parse(req.params.viewId);
		const data = viewValidator.update.parse(req.body);
		return [req.params.mapSlug, viewId, data];
	}, "json"),

	deleteView: apiImpl.del("/map/:mapSlug/view/:viewId", (req) => {
		const viewId = stringifiedIdValidator.parse(req.params.viewId);
		return [req.params.mapSlug, viewId];
	}, "empty"),

	find: apiImpl.get("/find", (req) => {
		const { query } = z.object({
			query: z.string()
		}).parse(req.query);
		return [query];
	}, "json"),

	findUrl: apiImpl.get("/find/url", (req) => {
		const { url } = z.object({
			url: z.string()
		}).parse(req.query);
		return [url];
	}, (res, result) => {
		void result.data.pipeTo(writableToWeb(res));
	}),

	getRoute: apiImpl.get("/route", (req) => {
		const { destinations, mode } = z.object({
			destinations: stringifiedJsonValidator.pipe(z.array(pointValidator)),
			mode: routeModeValidator
		}).parse(req.query);
		return [{ destinations, mode }];
	}, "json"),

	geoip: apiImpl.get("/geoip", (req) => [], (res, result) => {
		if (result) {
			res.json(result);
		} else {
			res.status(204).send();
		}
	})
};