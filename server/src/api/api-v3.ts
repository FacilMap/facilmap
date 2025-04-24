import {
	ApiVersion, CRU, DEFAULT_PAGING, allMapObjectsPickValidator, bboxWithExceptValidator, bboxWithZoomValidator,
	exportFormatValidator, isMapToken, lineValidator, mapDataValidator, mapPermissionsValidator, markerValidator, pagingValidator, pointValidator,
	routeModeValidator, stringifiedBooleanValidator, stringifiedIdValidator, typeValidator, viewValidator,
	type AllMapObjectsItem, type AllMapObjectsPick, type AllMapObjectsTypes, type AnyMapSlug, type Api,
	type Bbox, type BboxWithExcept, type BboxWithZoom, type DeepReadonly, type ExportFormat, type FindMapsResult, type FindOnMapResult,
	type HistoryEntry, type ID, type Line, type LinePoints, type LineTemplate, type LineWithTrackPoints, type MapData,
	type MapPermissions,
	type Marker, type PagedResults, type Route, type RouteInfo, type RouteRequest, type SearchResult, type StreamedResults,
	type Stripped,
	type TrackPoint, type Type, type View
} from "facilmap-types";
import * as z from "zod";
import type Database from "../database/database";
import { getI18n } from "../i18n";
import { apiImpl, getRequestMapSlug, stringArrayValidator, stringifiedJsonValidator, type ApiImpl } from "./api-common";
import { canAdministrateMap, checkAdministrateMap, checkConfigureMap, checkManageObject, checkReadObject, checkRevertHistoryEntry, checkUpdateObject, getLineTemplate, getMainAdminLink, getSafeFilename, mergeMapPermissions, normalizeLineName } from "facilmap-utils";
import { exportLineToTrackGpx, exportLineToRouteGpx } from "../export/gpx";
import { geoipLookup } from "../geoip";
import { calculateRoute } from "../routing/routing";
import { findQuery, findUrl } from "../search";
import { flatMapAsyncIterable, iterableToArray, mapAsyncIterable, writableToWeb } from "../utils/streams";
import { arrayStream, stringifyJsonStream, objectStream, type SerializableJsonValue } from "json-stream-es";
import { exportLineToGeoJson } from "../export/geojson";
import { createMapToken, decodeMapTokenUnverified, getPasswordHash, verifyMapToken } from "../utils/crypt";
import { stripDataUpdate, stripHistoryEntry, stripLine, stripLineOrThrow, stripLinePoints, stripMapData, stripMapResult, stripMarker, stripMarkerOrThrow, stripType, stripTypeOrThrow, stripView, stripViewOrThrow, type RawMapData, type RawMapLink } from "../utils/permissions";
import { omit } from "lodash-es";

export class ApiV3Backend implements Api<ApiVersion.V3, true> {
	protected database: Database;
	protected remoteAddr: string | undefined;

	constructor(database: Database, remoteAddr: string | undefined) {
		this.database = database;
		this.remoteAddr = remoteAddr;
	}

	async resolveMapSlug(anyMapSlug: AnyMapSlug | RawMapLink): Promise<{
		mapData: Stripped<MapData>;
		rawMapData: RawMapData;
		activeLink: RawMapLink;
	}> {
		if (typeof anyMapSlug === "object" && "mapId" in anyMapSlug) {
			const rawMapData = await this.database.maps.getMapData(anyMapSlug.mapId, { notFound404: true });
			return {
				mapData: stripMapData(anyMapSlug, rawMapData),
				rawMapData,
				activeLink: anyMapSlug
			};
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
					mapId: unstrippedMapLink.mapId,
					slug: mapSlug,
					password: unstrippedMapLink.password,
					tokenHash: unstrippedMapLink.tokenHash,
					searchEngines: false,
					permissions: mergeMapPermissions(unstrippedMapLink.permissions, token.permissions)
				} satisfies RawMapLink;
			} else {
				rawMapLink = await this.database.maps.getMapLinkBySlug(mapSlug, { notFound404: true });
				rawMapData = await this.database.maps.getMapData(rawMapLink.mapId, { notFound404: true });
			}

			if (rawMapLink.password) {
				if (password == null) {
					throw Object.assign(new Error(getI18n().t("api.password-required")), {
						status: 401,
						headers: {
							"WWW-Authenticate": `Basic realm="${encodeURIComponent(mapSlug)}", charset="UTF-8`
						}
					});
				} else if (await getPasswordHash(password, rawMapData.salt) !== rawMapLink.password) {
					throw Object.assign(new Error(getI18n().t("api.wrong-password")), {
						status: 401,
						headers: {
							"WWW-Authenticate": `Basic realm="${encodeURIComponent(mapSlug)}", charset="UTF-8`
						}
					});
				}
			}

			return {
				mapData: stripMapData(rawMapLink, rawMapData),
				rawMapData,
				activeLink: rawMapLink
			};
		}
	}

	protected async* getMapObjectsUntyped(
		mapData: Stripped<MapData>,
		{ pick, bbox }: { pick: ReadonlyArray<AllMapObjectsPick>; bbox?: BboxWithZoom }
	): AsyncIterable<AllMapObjectsTypes[AllMapObjectsPick]> {
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

	protected getMapObjects<Pick extends AllMapObjectsPick>(
		mapData: Stripped<MapData>,
		{ pick, bbox }: { readonly pick: ReadonlyArray<Pick>; readonly bbox?: Readonly<BboxWithZoom> }
	): AsyncIterable<AllMapObjectsTypes[Pick]> {
		return this.getMapObjectsUntyped(mapData, { pick: pick as ReadonlyArray<AllMapObjectsPick>, bbox }) as AsyncIterable<AllMapObjectsTypes[Pick]>;
	}

	async findMaps(query: string, paging = DEFAULT_PAGING): Promise<PagedResults<FindMapsResult>> {
		return await this.database.maps.findMaps(query, paging);
	}

	async getMap(mapSlug: AnyMapSlug | RawMapLink): Promise<Stripped<MapData>> {
		const { mapData } = await this.resolveMapSlug(mapSlug);
		return mapData;
	}

	async createMap<Pick extends AllMapObjectsPick = "mapData" | "types">(data: DeepReadonly<MapData<CRU.CREATE_VALIDATED>>, options?: { readonly pick?: ReadonlyArray<Pick>; readonly bbox?: Readonly<BboxWithZoom> }): Promise<AsyncIterable<AllMapObjectsItem<Pick>>> {
		const { results } = await this._createMap(data, options);
		return results;
	}

	async _createMap<Pick extends AllMapObjectsPick = "mapData" | "types">(data: DeepReadonly<MapData<CRU.CREATE_VALIDATED>>, options?: { readonly pick?: ReadonlyArray<Pick>; readonly bbox?: Readonly<BboxWithZoom> }): Promise<{
		rawMapData: RawMapData;
		mapData: MapData;
		activeLink: RawMapLink;
		results: AsyncIterable<AllMapObjectsItem<Pick>>;
	}> {
		const rawMapData = await this.database.maps.createMap(data);
		const activeLink = getMainAdminLink(rawMapData.links);
		const mapData = stripMapData(activeLink, rawMapData);
		const results = this.getMapObjects(mapData, { ...options, pick: options?.pick ?? ["mapData", "types"] as Pick[] });
		return { rawMapData, activeLink, mapData, results };
	}

	async updateMap(mapSlug: AnyMapSlug | RawMapLink, data: MapData<CRU.UPDATE_VALIDATED>): Promise<Stripped<MapData>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);

		checkConfigureMap(activeLink.permissions);

		const update = canAdministrateMap(activeLink.permissions) ? data : omit(data, ["mapLinks"]);
		const result = await this.database.maps.updateMapData(mapData.id, update);
		return stripMapData(activeLink, result);
	}

	async deleteMap(mapSlug: AnyMapSlug | RawMapLink): Promise<void> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		checkAdministrateMap(activeLink.permissions);

		await this.database.maps.deleteMap(mapData.id);
	}

	async getAllMapObjects<Pick extends AllMapObjectsPick = "mapData" | "markers" | "lines" | "linesWithTrackPoints" | "types" | "views">(mapSlug: AnyMapSlug | RawMapLink, options?: { pick?: ReadonlyArray<Pick>; bbox?: BboxWithZoom }): Promise<AsyncIterable<AllMapObjectsItem<Pick>>> {
		const { mapData } = await this.resolveMapSlug(mapSlug);
		return this.getMapObjects(mapData, {
			...options,
			pick: options?.pick ?? ["mapData", "types", "views", ...options?.bbox ? ["markers", "linesWithTrackPoints"] : ["lines"]] as Pick[]
		});
	}

	async findOnMap(mapSlug: AnyMapSlug | RawMapLink, query: string): Promise<Array<Stripped<FindOnMapResult>>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		const results = await this.database.search.search(mapData.id, query);
		return results.flatMap((result) => {
			const stripped = stripMapResult(activeLink, result, false);
			return stripped ? [stripped] : [];
		});
	}

	async getMapToken(mapSlug: AnyMapSlug | RawMapLink, permissions: MapPermissions): Promise<{ token: string }> {
		const { activeLink, rawMapData } = await this.resolveMapSlug(mapSlug);
		const token = await createMapToken({ mapId: activeLink.mapId, tokenHash: activeLink.tokenHash, permissions }, rawMapData.jwtSecret);
		return { token };
	}

	async getHistory(mapSlug: AnyMapSlug | RawMapLink, paging = DEFAULT_PAGING): Promise<PagedResults<Stripped<HistoryEntry>>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);

		const results = await this.database.history.getPagedHistory(mapData.id, paging);
		return {
			results: results.results.flatMap((entry) => {
				const stripped = stripHistoryEntry(activeLink, entry, false);
				return stripped ? [stripped] : [];
			}),
			totalLength: results.totalLength
		};
	}

	async revertHistoryEntry(mapSlug: AnyMapSlug | RawMapLink, historyEntryId: ID): Promise<void> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);

		const entry = await this.database.history.getHistoryEntry(mapData.id, historyEntryId, { notFound404: true });

		checkRevertHistoryEntry(activeLink.permissions, entry as HistoryEntry, false);

		if(entry.type == "Map") {
			if (!entry.objectBefore) {
				throw new Error(getI18n().t("database.old-map-data-not-available-error"));
			}

			const update = canAdministrateMap(activeLink.permissions) ? entry.objectBefore : omit(entry.objectBefore, ["mapLinks"]);
			await this.database.maps.updateMapData(mapData.id, update);
			return;
		} else if (!["Marker", "Line", "View", "Type"].includes(entry.type)) {
			throw new Error(getI18n().t("database.unknown-type-error", { type: entry.type }));
		}

		const existsNow = (
			entry.type === "Marker" ? await this.database.markers.markerExists(mapData.id, entry.objectId) :
			entry.type === "Line" ? await this.database.lines.lineExists(mapData.id, entry.objectId) :
			entry.type === "Type" ? await this.database.types.typeExists(mapData.id, entry.objectId) :
			await this.database.views.viewExists(mapData.id, entry.objectId)
		);

		if(entry.action == "create") {
			if (existsNow) {
				if (entry.type === "Marker") {
					await this.deleteMarker(activeLink, entry.objectId);
				} else if (entry.type === "Line") {
					await this.deleteLine(activeLink, entry.objectId);
				} else if (entry.type === "View") {
					await this.deleteView(activeLink, entry.objectId);
				} else if (entry.type === "Type") {
					await this.deleteType(activeLink, entry.objectId);
				}
			}
		} else if (existsNow) {
			if (entry.type === "Marker") {
				await this.updateMarker(activeLink, entry.objectId, entry.objectBefore);
			} else if (entry.type === "Line") {
				await this.updateLine(activeLink, entry.objectId, entry.objectBefore);
			} else if (entry.type === "View") {
				await this.updateView(activeLink, entry.objectId, entry.objectBefore);
			} else if (entry.type === "Type") {
				await this.updateType(activeLink, entry.objectId, entry.objectBefore);
			}
		} else {
			if (entry.type === "Marker") {
				await this.createMarker(activeLink, entry.objectBefore, { id: entry.objectId });
			} else if (entry.type === "Line") {
				await this.createLine(activeLink, entry.objectBefore, { id: entry.objectId });
			} else if (entry.type === "View") {
				await this.createView(activeLink, entry.objectBefore, { id: entry.objectId });
			} else if (entry.type === "Type") {
				await this.createType(activeLink, entry.objectBefore, { id: entry.objectId });
			}
		}
	}

	protected _getMapMarkers(mapData: MapData, options?: { bbox?: BboxWithExcept; typeId?: ID }): AsyncIterable<Stripped<Marker>> {
		const results = (
			options?.typeId ? this.database.markers.getMapMarkersByType(mapData.id, options.typeId, options?.bbox) :
			this.database.markers.getMapMarkers(mapData.id, options?.bbox)
		);
		return flatMapAsyncIterable(results, (unstrippedMarker) => {
			const stripped = stripMarker(mapData.activeLink, unstrippedMarker, false);
			return stripped ? [stripped] : [];
		});
	}

	async getMapMarkers(mapSlug: AnyMapSlug | RawMapLink, options?: { bbox?: BboxWithExcept; typeId?: ID }): Promise<StreamedResults<Stripped<Marker>>> {
		const { mapData } = await this.resolveMapSlug(mapSlug);

		return {
			results: this._getMapMarkers(mapData, options)
		};
	}

	async getMarker(mapSlug: AnyMapSlug | RawMapLink, markerId: ID): Promise<Stripped<Marker>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		const unstrippedMarker = await this.database.markers.getMarker(mapData.id, markerId, { notFound404: true });
		return stripMarkerOrThrow(activeLink, unstrippedMarker, false);
	}

	async createMarker(mapSlug: AnyMapSlug | RawMapLink, data: Marker<CRU.CREATE_VALIDATED>, internalOptions?: { id?: ID }): Promise<Stripped<Marker>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		checkUpdateObject(activeLink.permissions, data.typeId, false);
		const create = {
			...data,
			data: stripDataUpdate(activeLink, data.typeId, data.data, false)
		};
		const result = await this.database.markers.createMarker(mapData.id, create, internalOptions);
		return stripMarkerOrThrow(activeLink, result, false);
	}

	async updateMarker(mapSlug: AnyMapSlug | RawMapLink, markerId: ID, data: Marker<CRU.UPDATE_VALIDATED>): Promise<Stripped<Marker>> {
		const { activeLink } = await this.resolveMapSlug(mapSlug);

		const originalMarker = await this.getMarker(activeLink, markerId);

		checkUpdateObject(activeLink.permissions, originalMarker.typeId, false);
		if (data.typeId != null && data.typeId !== originalMarker.typeId) {
			checkUpdateObject(activeLink.permissions, data.typeId, false);
		}

		const newType = await this.getType(activeLink, data.typeId ?? originalMarker.typeId);

		const update = {
			...data,
			...data.data ? { data: stripDataUpdate(activeLink, newType.id, data.data, false) } : {}
		};
		const result = await this.database.markers._updateMarker(originalMarker, update, newType);
		return stripMarkerOrThrow(activeLink, result, false);
	}

	async deleteMarker(mapSlug: AnyMapSlug | RawMapLink, markerId: ID): Promise<void> {
		const { activeLink } = await this.resolveMapSlug(mapSlug);
		const marker = await this.getMarker(activeLink, markerId);
		checkManageObject(activeLink.permissions, marker.typeId, false);
		await this.database.markers._deleteMarker(marker);
	}

	async* _getMapLines<IncludeTrackPoints extends boolean = false>(mapData: MapData, options?: { bbox?: BboxWithExcept; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }): AsyncIterable<IncludeTrackPoints extends true ? Stripped<LineWithTrackPoints> : Stripped<Line>> {
		for await (const line of options?.typeId ? this.database.lines.getMapLinesByType(mapData.id, options.typeId) : this.database.lines.getMapLines(mapData.id)) {
			const stripped = stripLine(mapData.activeLink, line, false);
			if (stripped) {
				if (options?.includeTrackPoints) {
					const trackPoints = await iterableToArray(this.database.lines.getLinePointsForLine(line.id, options?.bbox));
					yield { ...stripped, trackPoints } as Stripped<LineWithTrackPoints>;
				} else {
					yield stripped as IncludeTrackPoints extends true ? Stripped<LineWithTrackPoints> : Stripped<Line>;
				}
			}
		}
	}

	_getMapLinePoints(mapData: MapData, options?: { bbox?: BboxWithZoom }): AsyncIterable<Stripped<LinePoints>> {
		return flatMapAsyncIterable(this.database.lines.getLinePointsForMap(mapData.id, options?.bbox), async (linePoints) => {
			const result = stripLinePoints(mapData.activeLink, linePoints, false);
			return result ? [result] : [];
		});
	}

	async getMapLines<IncludeTrackPoints extends boolean = false>(mapSlug: AnyMapSlug | RawMapLink, options?: { bbox?: BboxWithZoom; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }): Promise<StreamedResults<IncludeTrackPoints extends true ? Stripped<LineWithTrackPoints> : Stripped<Line>>> {
		const { mapData } = await this.resolveMapSlug(mapSlug);
		return {
			results: this._getMapLines(mapData, options)
		};
	}

	async getLine(mapSlug: AnyMapSlug | RawMapLink, lineId: ID): Promise<Stripped<Line>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		const line = await this.database.lines.getLine(mapData.id, lineId, { notFound404: true });
		return stripLineOrThrow(activeLink, line, false);
	}

	async getLinePoints(mapSlug: AnyMapSlug | RawMapLink, lineId: ID, options?: { bbox?: BboxWithZoom }): Promise<StreamedResults<TrackPoint>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		const line = await this.database.lines.getLine(mapData.id, lineId, { notFound404: true });
		checkReadObject(activeLink.permissions, line.typeId, false);
		return {
			results: this.database.lines.getLinePointsForLine(line.id, options?.bbox)
		};
	}

	async createLine(mapSlug: AnyMapSlug | RawMapLink, data: Line<CRU.CREATE_VALIDATED>, internalOptions?: { id?: ID; trackPointsFromRoute?: Route & { trackPoints: AsyncIterable<TrackPoint> } }): Promise<Stripped<Line>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		checkUpdateObject(activeLink.permissions, data.typeId, false);
		const create = {
			...data,
			data: stripDataUpdate(activeLink, data.typeId, data.data, false)
		};
		const result = await this.database.lines.createLine(mapData.id, create, internalOptions);
		return stripLineOrThrow(activeLink, result, false);
	}

	async updateLine(mapSlug: AnyMapSlug | RawMapLink, lineId: ID, data: Line<CRU.UPDATE_VALIDATED>, trackPointsFromRoute?: Route & { trackPoints: AsyncIterable<TrackPoint> }): Promise<Stripped<Line>> {
		const { activeLink } = await this.resolveMapSlug(mapSlug);

		const originalLine = await this.getLine(activeLink, lineId);

		checkUpdateObject(activeLink.permissions, originalLine.typeId, false);
		if (data.typeId != null && data.typeId !== originalLine.typeId) {
			checkUpdateObject(activeLink.permissions, data.typeId, false);
		}

		const newType = await this.getType(activeLink, data.typeId ?? originalLine.typeId);

		const update = {
			...data,
			...data.data ? { data: stripDataUpdate(activeLink, newType.id, data.data, false) } : {}
		};
		const result = await this.database.lines._updateLine(originalLine, update, newType, { trackPointsFromRoute });
		return stripLineOrThrow(activeLink, result, false);
	}

	async deleteLine(mapSlug: AnyMapSlug | RawMapLink, lineId: ID): Promise<void> {
		const { activeLink } = await this.resolveMapSlug(mapSlug);
		const line = await this.getLine(activeLink, lineId);
		checkManageObject(activeLink.permissions, line.typeId, false);
		await this.database.lines._deleteLine(line);
	}

	async exportLine(mapSlug: AnyMapSlug | RawMapLink, lineId: ID, options: { format: ExportFormat }): Promise<{ type: string; filename: string; data: ReadableStream<Uint8Array> }> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);

		const lineP = this.database.lines.getLine(mapData.id, lineId, { notFound404: true });
		lineP.catch(() => null); // Avoid unhandled promise error (https://stackoverflow.com/a/59062117/242365)

		const [lineUnstripped, typeUnstripped] = await Promise.all([
			lineP,
			lineP.then((line) => this.database.types.getType(mapData.id, line.typeId))
		]);

		const line = stripLineOrThrow(activeLink, lineUnstripped, false);
		const type = stripTypeOrThrow(activeLink, typeUnstripped);

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
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		const typeUnstripped = await this.database.types.getType(mapData.id, options.typeId, { notFound404: true });
		const type = stripTypeOrThrow(activeLink, typeUnstripped);
		return getLineTemplate(type);
	}

	_getMapTypes(mapData: MapData): AsyncIterable<Stripped<Type>> {
		return flatMapAsyncIterable(this.database.types.getTypes(mapData.id), (type) => {
			const result = stripType(mapData.activeLink, type);
			return result ? [result] : [];
		});
	}

	async getMapTypes(mapSlug: AnyMapSlug | RawMapLink): Promise<StreamedResults<Stripped<Type>>> {
		const { mapData } = await this.resolveMapSlug(mapSlug);
		return {
			results: this._getMapTypes(mapData)
		};
	}

	async getType(mapSlug: AnyMapSlug | RawMapLink, typeId: ID): Promise<Stripped<Type>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		const typeUnstripped = await this.database.types.getType(mapData.id, typeId, { notFound404: true });
		return stripTypeOrThrow(activeLink, typeUnstripped);
	}

	async createType(mapSlug: AnyMapSlug | RawMapLink, data: Type<CRU.CREATE_VALIDATED>, internalOptions?: { id?: ID }): Promise<Stripped<Type>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		checkConfigureMap(activeLink.permissions);
		const typeUnstripped = await this.database.types.createType(mapData.id, data, internalOptions);
		return stripTypeOrThrow(activeLink, typeUnstripped);
	}

	async updateType(mapSlug: AnyMapSlug | RawMapLink, typeId: ID, data: Type<CRU.UPDATE_VALIDATED>): Promise<Stripped<Type>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		checkConfigureMap(activeLink.permissions);
		checkManageObject(activeLink.permissions, typeId, false);
		const typeUnstripped = await this.database.types.updateType(mapData.id, typeId, data, { notFound404: true });
		return stripTypeOrThrow(activeLink, typeUnstripped);
	}

	async deleteType(mapSlug: AnyMapSlug | RawMapLink, typeId: ID): Promise<void> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		checkConfigureMap(activeLink.permissions);
		checkManageObject(activeLink.permissions, typeId, false);
		await this.database.types.deleteType(mapData.id, typeId, { notFound404: true });
	}

	_getMapViews(mapData: MapData): AsyncIterable<Stripped<View>> {
		return flatMapAsyncIterable(this.database.views.getViews(mapData.id), (view) => {
			const result = stripView(mapData.activeLink, view);
			return result ? [result] : [];
		});
	}

	async getMapViews(mapSlug: AnyMapSlug | RawMapLink): Promise<StreamedResults<Stripped<View>>> {
		const { mapData } = await this.resolveMapSlug(mapSlug);
		return {
			results: this._getMapViews(mapData)
		};
	}

	async getView(mapSlug: AnyMapSlug | RawMapLink, viewId: ID): Promise<Stripped<View>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		const viewUnstripped = await this.database.views.getView(mapData.id, viewId, { notFound404: true });
		return stripViewOrThrow(activeLink, viewUnstripped);
	}

	async createView(mapSlug: AnyMapSlug | RawMapLink, data: View<CRU.CREATE_VALIDATED>, internalOptions?: { id?: ID }): Promise<Stripped<View>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		checkConfigureMap(activeLink.permissions);
		const viewUnstripped = await this.database.views.createView(mapData.id, data, internalOptions);
		return stripViewOrThrow(activeLink, viewUnstripped);
	}

	async updateView(mapSlug: AnyMapSlug | RawMapLink, viewId: ID, data: View<CRU.UPDATE_VALIDATED>): Promise<Stripped<View>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		checkConfigureMap(activeLink.permissions);
		const viewUnstripped = await this.database.views.updateView(mapData.id, viewId, data, { notFound404: true });
		return stripViewOrThrow(activeLink, viewUnstripped);
	}

	async deleteView(mapSlug: AnyMapSlug | RawMapLink, viewId: ID): Promise<void> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		checkConfigureMap(activeLink.permissions);
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

	getMap: apiImpl.get("/map/:mapSlug", (req) => [getRequestMapSlug(req)], "json"),

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

	updateMap: apiImpl.put("/map/:mapSlug", (req) => [getRequestMapSlug(req), mapDataValidator.update.parse(req.body)], "json"),

	deleteMap: apiImpl.del("/map/:mapSlug", (req) => [getRequestMapSlug(req)], "empty"),

	getAllMapObjects: apiImpl.get("/map/:mapSlug/all", (req) => {
		const { pick, bbox } = z.object({
			pick: stringArrayValidator.pipe(z.array(allMapObjectsPickValidator)).optional(),
			bbox: stringifiedJsonValidator.pipe(bboxWithZoomValidator).optional()
		}).parse(req.query);
		return [getRequestMapSlug(req), { pick, bbox }];
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
		return [getRequestMapSlug(req), query];
	}, "json"),

	getMapToken: apiImpl.get("/map/:mapSlug/token", (req) => {
		const { permissions } = z.object({
			permissions: stringifiedJsonValidator.pipe(mapPermissionsValidator)
		}).parse(req.query);
		return [getRequestMapSlug(req), permissions];
	}, "json"),

	getHistory: apiImpl.get("/map/:mapSlug/history", (req) => {
		const paging = pagingValidator.parse(req.query);
		return [getRequestMapSlug(req), paging];
	}, "json"),

	revertHistoryEntry: apiImpl.post("/map/:mapSlug/history/:historyEntryId/revert", (req) => {
		const historyEntryId = stringifiedIdValidator.parse(req.params.historyEntryId);
		return [getRequestMapSlug(req), historyEntryId];
	}, "empty"),

	getMapMarkers: apiImpl.get("/map/:mapSlug/marker", (req) => {
		const { bbox, typeId } = z.object({
			bbox: stringifiedJsonValidator.pipe(bboxWithExceptValidator).optional(),
			typeId: stringifiedIdValidator.optional()
		}).parse(req.query);
		return [getRequestMapSlug(req), { bbox, typeId }];
	}, "stream"),

	getMarker: apiImpl.get("/map/:mapSlug/marker/:markerId", (req) => {
		const markerId = stringifiedIdValidator.parse(req.params.markerId);
		return [getRequestMapSlug(req), markerId];
	}, "json"),

	createMarker: apiImpl.post("/map/:mapSlug/marker", (req) => [getRequestMapSlug(req), markerValidator.create.parse(req.body)], "json"),

	updateMarker: apiImpl.put("/map/:mapSlug/marker/:markerId", (req) => {
		const markerId = stringifiedIdValidator.parse(req.params.markerId);
		const data = markerValidator.update.parse(req.body);
		return [getRequestMapSlug(req), markerId, data];
	}, "json"),

	deleteMarker: apiImpl.del("/map/:mapSlug/marker/:markerId", (req) => {
		const markerId = stringifiedIdValidator.parse(req.params.markerId);
		return [getRequestMapSlug(req), markerId];
	}, "empty"),

	getMapLines: apiImpl.get("/map/:mapSlug/line", (req) => {
		const { bbox, includeTrackPoints, typeId } = z.object({
			bbox: stringifiedJsonValidator.pipe(bboxWithExceptValidator).optional(),
			includeTrackPoints: stringifiedBooleanValidator.optional(),
			typeId: stringifiedIdValidator.optional()
		}).parse(req.query);
		return [getRequestMapSlug(req), { bbox, includeTrackPoints, typeId }];
	}, "stream"),

	// Above getLine because it has a matching signature
	getLineTemplate: apiImpl.get("/map/:mapSlug/line/template", (req) => {
		const { typeId } = z.object({
			typeId: stringifiedIdValidator
		}).parse(req.query);
		return [getRequestMapSlug(req), { typeId }];
	}, "json"),

	getLine: apiImpl.get("/map/:mapSlug/line/:lineId", (req) => {
		const lineId = stringifiedIdValidator.parse(req.params.lineId);
		return [getRequestMapSlug(req), lineId];
	}, "json"),

	getLinePoints: apiImpl.get("/map/:mapSlug/line/:lineId/linePoints", (req) => {
		const { bbox } = stringifiedJsonValidator.pipe(z.object({
			bbox: stringifiedJsonValidator.pipe(bboxWithExceptValidator)
		})).parse(req.query);
		const lineId = stringifiedIdValidator.parse(req.params.lineId);
		return [getRequestMapSlug(req), lineId, { bbox }];
	}, "stream"),

	createLine: apiImpl.post("/map/:mapSlug/line", (req) => [getRequestMapSlug(req), lineValidator.create.parse(req.body)], "json"),

	updateLine: apiImpl.put("/map/:mapSlug/line/:lineId", (req) => {
		const lineId = stringifiedIdValidator.parse(req.params.lineId);
		const data = lineValidator.update.parse(req.body);
		return [getRequestMapSlug(req), lineId, data];
	}, "json"),

	deleteLine: apiImpl.del("/map/:mapSlug/line/:lineId", (req) => {
		const lineId = stringifiedIdValidator.parse(req.params.lineId);
		return [getRequestMapSlug(req), lineId];
	}, "empty"),

	exportLine: apiImpl.get("/map/:mapSlug/line/:lineId/export", (req) => {
		const lineId = stringifiedIdValidator.parse(req.params.lineId);
		const { format } = z.object({
			format: exportFormatValidator.extract(["gpx-trk", "gpx-rte"])
		}).parse(req.query);
		return [getRequestMapSlug(req), lineId, { format }];
	}, (res, result) => {
		res.set("Content-type", result.type);
		res.attachment(result.filename);
		void result.data.pipeTo(writableToWeb(res));
	}),

	getMapTypes: apiImpl.get("/map/:mapSlug/type", (req) => [getRequestMapSlug(req)], "stream"),

	getType: apiImpl.get("/map/:mapSlug/type/:typeId", (req) => {
		const typeId = stringifiedIdValidator.parse(req.params.typeId);
		return [getRequestMapSlug(req), typeId];
	}, "json"),

	createType: apiImpl.post("/map/:mapSlug/type", (req) => [getRequestMapSlug(req), typeValidator.create.parse(req.body)], "json"),

	updateType: apiImpl.put("/map/:mapSlug/type/:typeId", (req) => {
		const typeId = stringifiedIdValidator.parse(req.params.typeId);
		const data = typeValidator.update.parse(req.body);
		return [getRequestMapSlug(req), typeId, data];
	}, "json"),

	deleteType: apiImpl.del("/map/:mapSlug/type/:typeId", (req) => {
		const typeId = stringifiedIdValidator.parse(req.params.typeId);
		return [getRequestMapSlug(req), typeId];
	}, "empty"),

	getMapViews: apiImpl.get("/map/:mapSlug/view", (req) => [getRequestMapSlug(req)], "stream"),

	getView: apiImpl.get("/map/:mapSlug/view/:viewId", (req) => {
		const viewId = stringifiedIdValidator.parse(req.params.viewId);
		return [getRequestMapSlug(req), viewId];
	}, "json"),

	createView: apiImpl.post("/map/:mapSlug/view", (req) => [getRequestMapSlug(req), viewValidator.create.parse(req.body)], "json"),

	updateView: apiImpl.put("/map/:mapSlug/view/:viewId", (req) => {
		const viewId = stringifiedIdValidator.parse(req.params.viewId);
		const data = viewValidator.update.parse(req.body);
		return [getRequestMapSlug(req), viewId, data];
	}, "json"),

	deleteView: apiImpl.del("/map/:mapSlug/view/:viewId", (req) => {
		const viewId = stringifiedIdValidator.parse(req.params.viewId);
		return [getRequestMapSlug(req), viewId];
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