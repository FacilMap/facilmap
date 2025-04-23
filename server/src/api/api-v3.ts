import {
	ApiVersion, CRU, DEFAULT_PAGING, allMapObjectsPickValidator, bboxWithExceptValidator, bboxWithZoomValidator,
	exportFormatValidator, isMapToken, lineValidator, mapDataValidator, markerValidator, pagingValidator, pointValidator,
	routeModeValidator, stringifiedBooleanValidator, stringifiedIdValidator, typeValidator, viewValidator,
	type AllAdminMapObjectsItem, type AllMapObjectsItem, type AllMapObjectsPick, type AllMapObjectsTypes, type AnyMapSlug, type Api,
	type Bbox, type BboxWithExcept, type BboxWithZoom, type ExportFormat, type FindMapsResult, type FindOnMapResult,
	type HistoryEntry, type ID, type Line, type LinePoints, type LineTemplate, type LineWithTrackPoints, type MapData,
	type MapSlug, type Marker, type PagedResults, type ReplaceProperties, type Route,
	type RouteInfo, type RouteRequest, type SearchResult, type StreamedResults, type TrackPoint, type Type,
	type View
} from "facilmap-types";
import * as z from "zod";
import type Database from "../database/database";
import { getI18n } from "../i18n";
import { apiImpl, stringArrayValidator, stringifiedJsonValidator, type ApiImpl } from "./api-common";
import { canAdministrateMap, canConfigureMap, checkAdministrateMap, checkConfigureMap, getLineTemplate, getSafeFilename, mergeMapPermissions, normalizeLineName } from "facilmap-utils";
import { exportLineToTrackGpx, exportLineToRouteGpx } from "../export/gpx";
import { geoipLookup } from "../geoip";
import { calculateRoute } from "../routing/routing";
import { findQuery, findUrl } from "../search";
import { flatMapAsyncIterable, iterableToArray, mapAsyncIterable, writableToWeb } from "../utils/streams";
import { arrayStream, stringifyJsonStream, objectStream, type SerializableJsonValue } from "json-stream-es";
import { exportLineToGeoJson } from "../export/geojson";
import { decodeMapTokenUnverified, getPasswordHash, verifyMapToken } from "../utils/crypt";
import { stripLine, stripLinePoints, stripMapData, stripMarker, stripType, stripView, type RawMapLink } from "../utils/permissions";
import { omit } from "lodash-es";

export class ApiV3Backend implements Api<ApiVersion.V3, true> {
	protected database: Database;
	protected remoteAddr: string | undefined;

	constructor(database: Database, remoteAddr: string | undefined) {
		this.database = database;
		this.remoteAddr = remoteAddr;
	}

	protected async resolveMapSlug(anyMapSlug: AnyMapSlug | RawMapLink): Promise<MapData> {
		if (typeof anyMapSlug === "object" && "mapId" in anyMapSlug) {
			const rawMapData = await this.database.maps.getMapData(anyMapSlug.mapId, { notFound404: true });
			return stripMapData(anyMapSlug, rawMapData);
		} else {
			const { mapSlug, password } = typeof anyMapSlug === "string" ? { mapSlug: anyMapSlug } : anyMapSlug;
			let rawMapLink;
			let rawMapData;
			if (isMapToken(mapSlug)) {
				const tokenUnverified = decodeMapTokenUnverified(mapSlug);
				const unstrippedMapLink = await this.database.maps.getMapLinkByHash(tokenUnverified.mapId, tokenUnverified.tokenHash, { notFound404: true });
				rawMapData = await this.database.maps.getMapData(unstrippedMapLink.mapId, { notFound404: true });
				const token = verifyMapToken(mapSlug, rawMapData.jwtSecret);
				rawMapLink = {
					...unstrippedMapLink,
					permissions: mergeMapPermissions(unstrippedMapLink.permissions, token.permissions)
				};
			} else {
				rawMapLink = await this.database.maps.getMapLinkBySlug(mapSlug, { notFound404: true });
				rawMapData = await this.database.maps.getMapData(rawMapLink.mapId, { notFound404: true });

				if (rawMapLink.password) {
					if (password == null) {
						throw Object.assign(new Error(getI18n().t("api.password-required")), { status: 401 });
					} else if (await getPasswordHash(password, rawMapData.salt) !== rawMapLink.password) {
						throw Object.assign(new Error(getI18n().t("api.wrong-password")), { status: 401 });
					}
				}
			}
			return stripMapData(rawMapLink, rawMapData);
		}
	}

	protected async* getMapObjectsUntyped(
		mapData: MapData,
		{ pick, bbox }: { pick: ReadonlyArray<AllMapObjectsPick>; bbox?: BboxWithZoom }
	): AsyncIterable<AllMapObjectsTypes[AllMapObjectsPick]> {
		if (pick.includes("mapData")) {
			yield { type: "mapData", data: mapData };
		}

		if (pick.includes("types")) {
			yield { type: "types", data: flatMapAsyncIterable(this._getMapTypes(mapData), (type) => {
				const result = stripType(mapData.activeLink, type);
				return result ? [result] : [];
			}) };
		}

		if (pick.includes("views")) {
			yield { type: "views", data: flatMapAsyncIterable(this._getMapViews(mapData), (view) => {
				const result = stripView(mapData.activeLink, view);
				return result ? [result] : [];
			}) };
		}

		if (pick.includes("markers")) {
			yield { type: "markers", data: flatMapAsyncIterable(this._getMapMarkers(mapData, { bbox }), (marker) => {
				const result = stripMarker(mapData.activeLink, marker, false);
				return result ? [result] : [];
			}) };
		}

		if (pick.includes("lines") || pick.includes("linesWithTrackPoints")) {
			yield { type: "lines", data: flatMapAsyncIterable(this._getMapLines(mapData, { includeTrackPoints: pick.includes("linesWithTrackPoints"), bbox }), (line) => {
				const result = stripLine(mapData.activeLink, line, false);
				return result ? [result] : [];
			}) };
		}

		if (pick.includes("linePoints")) {
			yield { type: "linePoints", data: this._getMapLinePoints(mapData, { bbox }) };
		}
	}

	protected getMapObjects<Pick extends AllMapObjectsPick>(
		mapData: MapData,
		{ pick, bbox }: { readonly pick: ReadonlyArray<Pick>; readonly bbox?: Readonly<BboxWithZoom> }
	): AsyncIterable<AllMapObjectsTypes[Pick]> {
		return this.getMapObjectsUntyped(mapData, { pick: pick as ReadonlyArray<AllMapObjectsPick>, bbox }) as AsyncIterable<AllMapObjectsTypes[Pick]>;
	}

	async findMaps(query: string, paging = DEFAULT_PAGING): Promise<PagedResults<FindMapsResult>> {
		return await this.database.maps.findMaps(query, paging);
	}

	async getMap(mapSlug: AnyMapSlug | RawMapLink): Promise<MapData> {
		return await this.resolveMapSlug(mapSlug);
	}

	async createMap<Pick extends AllMapObjectsPick = "mapData" | "types">(data: MapData<CRU.CREATE_VALIDATED>, options?: { readonly pick?: ReadonlyArray<Pick>; readonly bbox?: Readonly<BboxWithZoom> }): Promise<AsyncIterable<AllAdminMapObjectsItem<Pick>>> {
		const mapData = await this.database.maps.createMap(data);
		return this.getMapObjects(mapData, { ...options, pick: options?.pick ?? ["mapData", "types"] as Pick[] });
	}

	async updateMap(mapSlug: AnyMapSlug | RawMapLink, data: MapData<CRU.UPDATE_VALIDATED>): Promise<MapData> {
		const mapData = await this.resolveMapSlug(mapSlug);

		checkConfigureMap(mapData.activeLink.permissions);

		const resolvedData = canAdministrateMap(mapData.activeLink.permissions) ? data : omit(data, ["mapLinks"]);

		return await this.database.maps.updateMapData(mapData.id, resolvedData);
	}

	async deleteMap(mapSlug: AnyMapSlug | RawMapLink): Promise<void> {
		const mapData = await this.resolveMapSlug(mapSlug);
		checkAdministrateMap(mapData.activeLink.permissions);

		await this.database.maps.deleteMap(mapData.id);
	}

	async getAllMapObjects<Pick extends AllMapObjectsPick = "mapData" | "markers" | "lines" | "linesWithTrackPoints" | "types" | "views">(mapSlug: AnyMapSlug | RawMapLink, options?: { pick?: ReadonlyArray<Pick>; bbox?: BboxWithZoom }): Promise<AsyncIterable<AllMapObjectsItem<Pick>>> {
		const mapData = await this.resolveMapSlug(mapSlug);
		return this.getMapObjects(mapData, {
			...options,
			pick: options?.pick ?? ["mapData", "types", "views", ...options?.bbox ? ["markers", "linesWithTrackPoints"] : ["lines"]] as Pick[]
		});
	}

	async findOnMap(mapSlug: AnyMapSlug | RawMapLink, query: string): Promise<FindOnMapResult[]> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return await this.database.search.search(mapData.id, query);
	}

	async getHistory(mapSlug: AnyMapSlug | RawMapLink, paging = DEFAULT_PAGING): Promise<PagedResults<HistoryEntry>> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);

		return await this.database.history.getPagedHistory(mapData.id, mapData.writable === Writable.ADMIN ? undefined : ["Marker", "Line"], paging);
	}

	async revertHistoryEntry(mapSlug: AnyMapSlug | RawMapLink, historyEntryId: ID): Promise<void> {
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

	async getMapMarkers(mapSlug: AnyMapSlug | RawMapLink, options?: { bbox?: BboxWithExcept; typeId?: ID }): Promise<StreamedResults<Marker>> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);

		return {
			results: this._getMapMarkers(mapData, options)
		};
	}

	async getMarker(mapSlug: AnyMapSlug | RawMapLink, markerId: ID): Promise<Marker> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return await this.database.markers.getMarker(mapData.id, markerId, { notFound404: true });
	}

	async createMarker(mapSlug: AnyMapSlug | RawMapLink, data: Marker<CRU.CREATE_VALIDATED>): Promise<Marker> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);
		return await this.database.markers.createMarker(mapData.id, data);
	}

	async updateMarker(mapSlug: AnyMapSlug | RawMapLink, markerId: ID, data: Marker<CRU.UPDATE_VALIDATED>): Promise<Marker> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);
		return await this.database.markers.updateMarker(mapData.id, markerId, data, { notFound404: true });
	}

	async deleteMarker(mapSlug: AnyMapSlug | RawMapLink, markerId: ID): Promise<void> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);
		await this.database.markers.deleteMarker(mapData.id, markerId, { notFound404: true });
	}

	async* _getMapLines<IncludeTrackPoints extends boolean = false>(mapData: MapDataWithWritable, options?: { bbox?: BboxWithExcept; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }): AsyncIterable<IncludeTrackPoints extends true ? LineWithTrackPoints : Line> {
		for await (const line of options?.typeId ? this.database.lines.getMapLinesByType(mapData.id, options.typeId) : this.database.lines.getMapLines(mapData.id)) {
			if (options?.includeTrackPoints) {
				const trackPoints = await iterableToArray(this.database.lines.getLinePointsForLine(line.id, options?.bbox));
				yield { ...line, trackPoints } as LineWithTrackPoints;
			} else {
				yield line as IncludeTrackPoints extends true ? LineWithTrackPoints : Line;
			}
		}
	}

	_getMapLinePoints(mapData: MapData, options?: { bbox?: BboxWithZoom }): AsyncIterable<LinePoints> {
		return flatMapAsyncIterable(this.database.lines.getLinePointsForMap(mapData.id, options?.bbox), async (linePoints) => {
			const result = stripLinePoints(mapData.activeLink, linePoints, false);
			return result ? [result] : [];
		});
	}

	async getMapLines<IncludeTrackPoints extends boolean = false>(mapSlug: AnyMapSlug | RawMapLink, options?: { bbox?: BboxWithZoom; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }): Promise<StreamedResults<IncludeTrackPoints extends true ? LineWithTrackPoints : Line>> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return {
			results: this._getMapLines(mapData, options)
		};
	}

	async getLine(mapSlug: AnyMapSlug | RawMapLink, lineId: ID): Promise<Line> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return await this.database.lines.getLine(mapData.id, lineId, { notFound404: true });
	}

	async getLinePoints(mapSlug: AnyMapSlug | RawMapLink, lineId: ID, options?: { bbox?: BboxWithZoom }): Promise<StreamedResults<TrackPoint>> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		const line = await this.database.lines.getLine(mapData.id, lineId, { notFound404: true });
		return {
			results: this.database.lines.getLinePointsForLine(line.id, options?.bbox)
		};
	}

	async createLine(mapSlug: AnyMapSlug | RawMapLink, data: Line<CRU.CREATE_VALIDATED>, trackPointsFromRoute?: Route & { trackPoints: AsyncIterable<TrackPoint> }): Promise<Line> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);
		return await this.database.lines.createLine(mapData.id, data, { trackPointsFromRoute });
	}

	async updateLine(mapSlug: AnyMapSlug | RawMapLink, lineId: ID, data: Line<CRU.UPDATE_VALIDATED>, trackPointsFromRoute?: Route & { trackPoints: AsyncIterable<TrackPoint> }): Promise<Line> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);
		return await this.database.lines.updateLine(mapData.id, lineId, data, { notFound404: true, trackPointsFromRoute });
	}

	async deleteLine(mapSlug: AnyMapSlug | RawMapLink, lineId: ID): Promise<void> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);
		await this.database.lines.deleteLine(mapData.id, lineId, { notFound404: true });
	}

	async exportLine(mapSlug: AnyMapSlug | RawMapLink, lineId: ID, options: { format: ExportFormat }): Promise<{ type: string; filename: string; data: ReadableStream<Uint8Array> }> {
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
					data: exportLineToTrackGpx(line, type, this.database.lines.getLinePointsForLine(line.id)).pipeThrough(new TextEncoderStream())
				};
			case "gpx-rte":
				return {
					type: "application/gpx+xml",
					filename: `${filename}.gpx`,
					data: exportLineToRouteGpx(line, type).pipeThrough(new TextEncoderStream())
				};
			case "geojson":
				return {
					type: "application/geo+json",
					filename: `${filename}.geojson`,
					data: exportLineToGeoJson(line, type, this.database.lines.getLinePointsForLine(line.id)).pipeThrough(new TextEncoderStream())
				};
			default:
				throw new Error(getI18n().t("api.unknown-format-error"));
		}
	}

	async getLineTemplate(mapSlug: AnyMapSlug | RawMapLink, options: { typeId: ID }): Promise<LineTemplate> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		const type = await this.database.types.getType(mapData.id, options.typeId, { notFound404: true });
		return getLineTemplate(type);
	}

	_getMapTypes(mapData: MapDataWithWritable): AsyncIterable<Type> {
		return this.database.types.getTypes(mapData.id);
	}

	async getMapTypes(mapSlug: AnyMapSlug | RawMapLink): Promise<StreamedResults<Type>> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return {
			results: this._getMapTypes(mapData)
		};
	}

	async getType(mapSlug: AnyMapSlug | RawMapLink, typeId: ID): Promise<Type> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return await this.database.types.getType(mapData.id, typeId, { notFound404: true });
	}

	async createType(mapSlug: AnyMapSlug | RawMapLink, data: Type<CRU.CREATE_VALIDATED>): Promise<Type> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		return await this.database.types.createType(mapData.id, data);
	}

	async updateType(mapSlug: AnyMapSlug | RawMapLink, typeId: ID, data: Type<CRU.UPDATE_VALIDATED>): Promise<Type> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		return await this.database.types.updateType(mapData.id, typeId, data, { notFound404: true });
	}

	async deleteType(mapSlug: AnyMapSlug | RawMapLink, typeId: ID): Promise<void> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		await this.database.types.deleteType(mapData.id, typeId, { notFound404: true });
	}

	_getMapViews(mapData: MapDataWithWritable): AsyncIterable<View> {
		return this.database.views.getViews(mapData.id);
	}

	async getMapViews(mapSlug: AnyMapSlug | RawMapLink): Promise<StreamedResults<View>> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return {
			results: this._getMapViews(mapData)
		};
	}

	async getView(mapSlug: AnyMapSlug | RawMapLink, viewId: ID): Promise<View> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return await this.database.views.getView(mapData.id, viewId, { notFound404: true });
	}

	async createView(mapSlug: AnyMapSlug | RawMapLink, data: View<CRU.CREATE_VALIDATED>): Promise<View> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		return await this.database.views.createView(mapData.id, data);
	}

	async updateView(mapSlug: AnyMapSlug | RawMapLink, viewId: ID, data: View<CRU.UPDATE_VALIDATED>): Promise<View> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		return await this.database.views.updateView(mapData.id, viewId, data, { notFound404: true });
	}

	async deleteView(mapSlug: AnyMapSlug | RawMapLink, viewId: ID): Promise<void> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		await this.database.views.deleteView(mapData.id, viewId, { notFound404: true });
	}

	async find(query: string): Promise<SearchResult[]> {
		return await findQuery(query);
	}

	async findUrl(url: string): Promise<{ data: ReadableStream<Uint8Array> }> {
		const result = await findUrl(url);
		return { data: result.data };
	}

	async getRoute(data: RouteRequest): Promise<RouteInfo> {
		return await calculateRoute(data.routePoints, data.mode);
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
			pick: stringArrayValidator.pipe(z.array(allMapObjectsPickValidator)).optional(),
			bbox: stringifiedJsonValidator.pipe(bboxWithZoomValidator).optional()
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

	// Above getLine because it has a matching signature
	getLineTemplate: apiImpl.get("/map/:mapSlug/line/template", (req) => {
		const { typeId } = z.object({
			typeId: stringifiedIdValidator
		}).parse(req.query);
		return [req.params.mapSlug, { typeId }];
	}, "json"),

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
			format: exportFormatValidator.extract(["gpx-trk", "gpx-rte"])
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
		return [{ routePoints: destinations, mode }];
	}, "json"),

	geoip: apiImpl.get("/geoip", (req) => [], (res, result) => {
		if (result) {
			res.json(result);
		} else {
			res.status(204).send();
		}
	})
};