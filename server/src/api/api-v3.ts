import {
	ApiVersion, CRU, DEFAULT_PAGING, allMapObjectsPickValidator, bboxWithExceptValidator, bboxWithZoomValidator,
	getMainAdminLink, lineValidator, mapDataValidator, mapPermissionsValidator, markerValidator, pagingValidator, pointValidator,
	routeModeValidator, stringifiedBooleanValidator, stringifiedIdValidator, typeValidator, viewValidator,
	type AllMapObjectsItem, type AllMapObjectsPick, type AllMapObjectsTypes, type AnyMapSlug, type Api,
	type Bbox, type BboxWithExcept, type BboxWithZoom, type DeepReadonly, type ExportResult, type FindMapsResult, type FindOnMapResult,
	type HistoryEntry, type ID, type Line, type LinePoints, type LineTemplate, type LineWithTrackPoints, type MapData,
	type MapPermissions, type Marker, type PagedResults, type Route, type RouteInfo, type RouteRequest, type SearchResult,
	type StreamedResults, type Stripped, type TrackPoint, type Type, type View
} from "facilmap-types";
import * as z from "zod";
import type Database from "../database/database";
import { getI18n } from "../i18n";
import { apiImpl, getRequestMapSlug, stringArrayValidator, stringifiedJsonValidator, type ApiImpl } from "./api-common";
import { canAdministrateMap, checkAdministrateMap, checkConfigureMap, checkManageObject, checkReadObject, checkRevertHistoryEntry, checkUpdateObject, checkUpdateType, getLineTemplate, getSafeFilename, mergeMapPermissions, normalizeLineName, normalizeMapName } from "facilmap-utils";
import { exportLineToTrackGpx, exportLineToRouteGpx, exportGpx, exportGpxZip } from "../export/gpx";
import { geoipLookup } from "../geoip";
import { calculateRoute } from "../routing/routing";
import { findQuery, findUrl } from "../search";
import { flatMapAsyncIterable, iterableToArray, mapAsyncIterable, writableToWeb } from "../utils/streams";
import { arrayStream, stringifyJsonStream, objectStream, type SerializableJsonValue } from "json-stream-es";
import { exportGeoJson, exportLineToGeoJson } from "../export/geojson";
import { createMapToken, getPasswordHashHash, getSlugHash } from "../utils/crypt";
import { resolveMapLinkAsync, stripDataUpdate, stripHistoryEntry, stripLine, stripLineOrThrow, stripLinePoints, stripMapData, stripMapResult, stripMarker, stripMarkerOrThrow, stripType, stripTypeOrThrow, stripView, stripViewOrThrow, type RawMapData, type RawActiveMapLink, isOwn } from "../utils/permissions";
import { omit } from "lodash-es";
import { createSingleTable } from "../export/table";
import { exportCsv } from "../export/csv";

export class ApiV3Backend implements Api<ApiVersion.V3, true> {
	protected database: Database;
	protected remoteAddr: string | undefined;

	constructor(database: Database, remoteAddr: string | undefined) {
		this.database = database;
		this.remoteAddr = remoteAddr;
	}

	async resolveMapSlug(anyMapSlug: AnyMapSlug | RawActiveMapLink): Promise<{
		mapData: Stripped<MapData>;
		rawMapData: RawMapData;
		activeLink: RawActiveMapLink;
	}> {
		if (typeof anyMapSlug === "object" && "mapId" in anyMapSlug) {
			const rawMapData = await this.database.maps.getMapData(anyMapSlug.mapId, { notFound404: true });
			return {
				mapData: stripMapData(anyMapSlug, rawMapData),
				rawMapData,
				activeLink: anyMapSlug
			};
		} else {
			const { mapSlug, password, identity } = typeof anyMapSlug === "string" ? { mapSlug: anyMapSlug } : anyMapSlug;

			const { rawMapData, activeLink } = await resolveMapLinkAsync(
				mapSlug,
				password,
				identity,
				(mapId) => this.database.maps.getMapData(mapId, { notFound404: true }),
				(mapSlug) => this.database.maps.getMapDataBySlug(mapSlug, { notFound404: true })
			);

			return {
				mapData: stripMapData(activeLink, rawMapData),
				rawMapData,
				activeLink
			};
		}
	}

	protected async* getMapObjectsUntyped(
		{ activeLink, rawMapData }: { activeLink: RawActiveMapLink; rawMapData: RawMapData },
		{ pick, bbox }: { pick: ReadonlyArray<AllMapObjectsPick>; bbox?: BboxWithZoom }
	): AsyncIterable<AllMapObjectsTypes[AllMapObjectsPick]> {
		if (pick.includes("mapData")) {
			yield { type: "mapData", data: stripMapData(activeLink, rawMapData) };
		}

		if (pick.includes("types")) {
			yield { type: "types", data: this._getMapTypes(activeLink) };
		}

		if (pick.includes("views")) {
			yield { type: "views", data: this._getMapViews(activeLink) };
		}

		if (pick.includes("markers")) {
			yield { type: "markers", data: this._getMapMarkers(activeLink, { bbox }) };
		}

		if (pick.includes("lines") || pick.includes("linesWithTrackPoints")) {
			yield { type: "lines", data: this._getMapLines(activeLink, { includeTrackPoints: pick.includes("linesWithTrackPoints"), bbox }) };
		}

		if (pick.includes("linePoints")) {
			yield { type: "linePoints", data: this._getMapLinePoints(activeLink, { bbox }) };
		}
	}

	protected getMapObjects<Pick extends AllMapObjectsPick>(
		{ activeLink, rawMapData }: { activeLink: RawActiveMapLink; rawMapData: RawMapData },
		{ pick, bbox }: { readonly pick: ReadonlyArray<Pick>; readonly bbox?: Readonly<BboxWithZoom> }
	): AsyncIterable<AllMapObjectsTypes[Pick]> {
		return this.getMapObjectsUntyped({ activeLink, rawMapData }, { pick: pick as ReadonlyArray<AllMapObjectsPick>, bbox }) as AsyncIterable<AllMapObjectsTypes[Pick]>;
	}

	async findMaps(query: string, paging = DEFAULT_PAGING): Promise<PagedResults<FindMapsResult>> {
		return await this.database.maps.findMaps(query, paging);
	}

	async getMap(mapSlug: AnyMapSlug | RawActiveMapLink): Promise<Stripped<MapData>> {
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
		activeLink: RawActiveMapLink;
		results: AsyncIterable<AllMapObjectsItem<Pick>>;
	}> {
		const rawMapData = await this.database.maps.createMap(data);
		const activeLink = getMainAdminLink(rawMapData.links);
		const mapData = stripMapData(activeLink, rawMapData);
		const results = this.getMapObjects({ rawMapData, activeLink }, { ...options, pick: options?.pick ?? ["mapData", "types"] as Pick[] });
		return { rawMapData, activeLink, mapData, results };
	}

	async updateMap(mapSlug: AnyMapSlug | RawActiveMapLink, data: MapData<CRU.UPDATE_VALIDATED>): Promise<Stripped<MapData>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);

		checkConfigureMap(activeLink.permissions);

		const update = { ...data };

		if (activeLink.id != null && canAdministrateMap(activeLink.permissions)) {
			if (data.links) {
				const currentLink = data.links.find((l) => "id" in l && l.id === activeLink.id);
				if (!currentLink) {
					throw Object.assign(new Error(getI18n().t("api.delete-current-link-error")), { status: 400 });
				} else if (!currentLink.permissions.admin) {
					throw Object.assign(new Error(getI18n().t("api.revoke-current-link-error")), { status: 400 });
				}
			}
		} else {
			delete update.links;
		}

		const result = await this.database.maps.updateMapData(mapData.id, update, { identity: activeLink.identity });

		const newActiveLink = activeLink.id != null ? result.links.find((l) => l.id === activeLink.id) : undefined;
		return stripMapData(newActiveLink ?? activeLink, result);
	}

	async deleteMap(mapSlug: AnyMapSlug | RawActiveMapLink): Promise<void> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		checkAdministrateMap(activeLink.permissions);

		await this.database.maps.deleteMap(mapData.id, { identity: activeLink.identity });
	}

	async getAllMapObjects<Pick extends AllMapObjectsPick = "mapData" | "markers" | "lines" | "linesWithTrackPoints" | "types" | "views">(mapSlug: AnyMapSlug | RawActiveMapLink, options?: { pick?: ReadonlyArray<Pick>; bbox?: BboxWithZoom }): Promise<AsyncIterable<AllMapObjectsItem<Pick>>> {
		const { rawMapData, activeLink } = await this.resolveMapSlug(mapSlug);
		return this.getMapObjects({ rawMapData, activeLink }, {
			...options,
			pick: options?.pick ?? ["mapData", "types", "views", ...options?.bbox ? ["markers", "linesWithTrackPoints"] : ["lines"]] as Pick[]
		});
	}

	async findOnMap(mapSlug: AnyMapSlug | RawActiveMapLink, query: string): Promise<Array<Stripped<FindOnMapResult>>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		const results = await this.database.search.search(mapData.id, query);
		return results.flatMap((result) => {
			const stripped = stripMapResult(activeLink, result);
			return stripped ? [stripped] : [];
		});
	}

	async getMapToken(mapSlug: AnyMapSlug | RawActiveMapLink, options: { permissions: MapPermissions; noPassword?: boolean }): Promise<{ token: string }> {
		const { activeLink, rawMapData } = await this.resolveMapSlug(mapSlug);
		const token = await createMapToken({
			mapId: activeLink.mapId,
			slugHash: activeLink.id == null ? activeLink.slugHash : getSlugHash(activeLink.slug, rawMapData.salt),
			passwordHash: options.noPassword && activeLink.password ? getPasswordHashHash(activeLink.password, rawMapData.salt) : undefined,
			permissions: activeLink.id == null ? mergeMapPermissions(options.permissions, activeLink.permissions) : options.permissions
		}, rawMapData.jwtSecret);
		return { token };
	}

	async exportMapAsGpx(mapSlug: AnyMapSlug | RawActiveMapLink, options?: { rte?: boolean; filter?: string }): Promise<ExportResult> {
		const { activeLink, mapData } = await this.resolveMapSlug(mapSlug);
		return {
			type: "application/gpx+xml",
			filename: `${getSafeFilename(normalizeMapName(mapData.name))}.gpx`,
			data: exportGpx(this, activeLink, !!options?.rte, options?.filter).pipeThrough(new TextEncoderStream())
		};
	}

	async exportMapAsGpxZip(mapSlug: AnyMapSlug | RawActiveMapLink, options?: { rte?: boolean; filter?: string }): Promise<ExportResult> {
		const { activeLink, mapData } = await this.resolveMapSlug(mapSlug);
		return {
			type: "application/zip",
			filename: `${getSafeFilename(normalizeMapName(mapData.name))}.zip`,
			data: exportGpxZip(this, activeLink, !!options?.rte, options?.filter)
		};
	}

	async exportMapAsGeoJson(mapSlug: AnyMapSlug | RawActiveMapLink, options?: { filter?: string }): Promise<ExportResult> {
		const { activeLink, mapData } = await this.resolveMapSlug(mapSlug);
		return {
			type: "application/geo+json",
			filename: `${getSafeFilename(normalizeMapName(mapData.name))}.geojson`,
			data: exportGeoJson(this, activeLink, options?.filter).pipeThrough(new TextEncoderStream())
		};
	}

	async exportMapAsTable(mapSlug: AnyMapSlug | RawActiveMapLink, options: { typeId: ID; filter?: string; hide?: string[] }): Promise<ExportResult> {
		const { activeLink, mapData } = await this.resolveMapSlug(mapSlug);
		const type = await this.getType(activeLink, options.typeId);
		return {
			type: "text/html",
			filename: `${getSafeFilename(normalizeMapName(mapData.name))} - ${getSafeFilename(type.name)}.html`,
			data: createSingleTable(
				this,
				activeLink,
				type,
				options.filter,
				options.hide
			).pipeThrough(new TextEncoderStream())
		};
	}

	async exportMapAsCsv(mapSlug: AnyMapSlug | RawActiveMapLink, options: { typeId: ID; filter?: string; hide?: string[] }): Promise<ExportResult> {
		const { activeLink, mapData } = await this.resolveMapSlug(mapSlug);
		const type = await this.getType(activeLink, options.typeId);
		return {
			type: "text/csv",
			filename: `${getSafeFilename(normalizeMapName(mapData.name))} - ${getSafeFilename(type.name)}.csv`,
			data: exportCsv(
				this,
				activeLink,
				type,
				options.filter,
				options.hide
			).pipeThrough(new TextEncoderStream())
		};
	}

	async getHistory(mapSlug: AnyMapSlug | RawActiveMapLink, paging = DEFAULT_PAGING): Promise<PagedResults<Stripped<HistoryEntry>>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);

		const results = await this.database.history.getPagedHistory(mapData.id, paging);
		return {
			results: results.results.flatMap((entry) => {
				const stripped = stripHistoryEntry(activeLink, entry);
				return stripped ? [stripped] : [];
			}),
			totalLength: results.totalLength
		};
	}

	async revertHistoryEntry(mapSlug: AnyMapSlug | RawActiveMapLink, historyEntryId: ID): Promise<void> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);

		const entry = await this.database.history.getHistoryEntry(mapData.id, historyEntryId, { notFound404: true });

		checkRevertHistoryEntry(
			activeLink.permissions,
			entry as HistoryEntry,
			!!(entry.objectBefore && "identity" in entry.objectBefore && isOwn(activeLink, entry.objectBefore)),
			!!(entry.objectAfter && "identity" in entry.objectAfter && isOwn(activeLink, entry.objectAfter))
		);

		if(entry.type == "Map") {
			if (!entry.objectBefore) {
				throw new Error(getI18n().t("database.old-map-data-not-available-error"));
			}

			const update = canAdministrateMap(activeLink.permissions) ? entry.objectBefore : omit(entry.objectBefore, ["links"]);
			await this.database.maps.updateMapData(mapData.id, update, { identity: activeLink.identity });
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

	protected _getMapMarkers(activeLink: RawActiveMapLink, options?: { bbox?: BboxWithExcept; typeId?: ID }): AsyncIterable<Stripped<Marker>> {
		const results = (
			options?.typeId ? this.database.markers.getMapMarkersByType(activeLink.mapId, options.typeId, options?.bbox) :
			this.database.markers.getMapMarkers(activeLink.mapId, options?.bbox)
		);
		return flatMapAsyncIterable(results, (rawMarker) => {
			const stripped = stripMarker(activeLink, rawMarker);
			return stripped ? [stripped] : [];
		});
	}

	async getMapMarkers(mapSlug: AnyMapSlug | RawActiveMapLink, options?: { bbox?: BboxWithExcept; typeId?: ID }): Promise<StreamedResults<Stripped<Marker>>> {
		const { activeLink } = await this.resolveMapSlug(mapSlug);

		return {
			results: this._getMapMarkers(activeLink, options)
		};
	}

	async getMarker(mapSlug: AnyMapSlug | RawActiveMapLink, markerId: ID): Promise<Stripped<Marker>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		const rawMarker = await this.database.markers.getMarker(mapData.id, markerId, { notFound404: true });
		return stripMarkerOrThrow(activeLink, rawMarker);
	}

	async createMarker(mapSlug: AnyMapSlug | RawActiveMapLink, data: Marker<CRU.CREATE_VALIDATED>, internalOptions?: { id?: ID }): Promise<Stripped<Marker>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		checkUpdateObject(activeLink.permissions, data.typeId, !!activeLink.identity);
		const create = {
			...data,
			data: stripDataUpdate(activeLink, data.typeId, data.data, !!activeLink.identity)
		};
		const result = await this.database.markers.createMarker(mapData.id, create, { identity: activeLink.identity, ...internalOptions });
		return stripMarkerOrThrow(activeLink, result);
	}

	async updateMarker(mapSlug: AnyMapSlug | RawActiveMapLink, markerId: ID, data: Marker<CRU.UPDATE_VALIDATED>): Promise<Stripped<Marker>> {
		const { activeLink, mapData } = await this.resolveMapSlug(mapSlug);

		const originalRawMarker = await this.database.markers.getMarker(mapData.id, markerId, { notFound404: true });

		checkUpdateObject(activeLink.permissions, originalRawMarker.typeId, isOwn(activeLink, originalRawMarker));
		if (data.typeId != null && data.typeId !== originalRawMarker.typeId) {
			checkUpdateObject(activeLink.permissions, data.typeId, isOwn(activeLink, originalRawMarker));
		}

		const newType = await this.getType(activeLink, data.typeId ?? originalRawMarker.typeId);

		const update = {
			...data,
			...data.data ? { data: stripDataUpdate(activeLink, newType.id, data.data, isOwn(activeLink, originalRawMarker)) } : {}
		};
		const result = await this.database.markers._updateMarker(originalRawMarker, update, newType, { identity: activeLink.identity });
		return stripMarkerOrThrow(activeLink, result);
	}

	async deleteMarker(mapSlug: AnyMapSlug | RawActiveMapLink, markerId: ID): Promise<void> {
		const { activeLink, mapData } = await this.resolveMapSlug(mapSlug);
		const rawMarker = await this.database.markers.getMarker(mapData.id, markerId, { notFound404: true });
		checkManageObject(activeLink.permissions, rawMarker.typeId, isOwn(activeLink, rawMarker));
		await this.database.markers._deleteMarker(rawMarker, { identity: activeLink.identity });
	}

	async* _getMapLines<IncludeTrackPoints extends boolean = false>(activeLink: RawActiveMapLink, options?: {
		bbox?: BboxWithExcept;
		includeTrackPoints?: IncludeTrackPoints;
		typeId?: ID;
	}): AsyncIterable<IncludeTrackPoints extends true ? Stripped<LineWithTrackPoints> : Stripped<Line>> {
		for await (const line of options?.typeId ? this.database.lines.getMapLinesByType(activeLink.mapId, options.typeId) : this.database.lines.getMapLines(activeLink.mapId)) {
			const stripped = stripLine(activeLink, line);
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

	_getMapLinePoints(activeLink: RawActiveMapLink, options?: { bbox?: BboxWithZoom }): AsyncIterable<Stripped<LinePoints>> {
		return flatMapAsyncIterable(this.database.lines.getLinePointsForMap(activeLink.mapId, options?.bbox), async (linePoints) => {
			const result = stripLinePoints(activeLink, linePoints);
			return result ? [result] : [];
		});
	}

	async getMapLines<IncludeTrackPoints extends boolean = false>(mapSlug: AnyMapSlug | RawActiveMapLink, options?: { bbox?: BboxWithZoom; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }): Promise<StreamedResults<IncludeTrackPoints extends true ? Stripped<LineWithTrackPoints> : Stripped<Line>>> {
		const { activeLink } = await this.resolveMapSlug(mapSlug);
		return {
			results: this._getMapLines(activeLink, options)
		};
	}

	async getLine(mapSlug: AnyMapSlug | RawActiveMapLink, lineId: ID): Promise<Stripped<Line>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		const line = await this.database.lines.getLine(mapData.id, lineId, { notFound404: true });
		return stripLineOrThrow(activeLink, line);
	}

	async getLinePoints(mapSlug: AnyMapSlug | RawActiveMapLink, lineId: ID, options?: { bbox?: BboxWithZoom }): Promise<StreamedResults<TrackPoint>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		const line = await this.database.lines.getLine(mapData.id, lineId, { notFound404: true });
		checkReadObject(activeLink.permissions, line.typeId, isOwn(activeLink, line));
		return {
			results: this.database.lines.getLinePointsForLine(line.id, options?.bbox)
		};
	}

	async createLine(mapSlug: AnyMapSlug | RawActiveMapLink, data: Line<CRU.CREATE_VALIDATED>, internalOptions?: { id?: ID; trackPointsFromRoute?: Route & { trackPoints: AsyncIterable<TrackPoint> } }): Promise<Stripped<Line>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		checkUpdateObject(activeLink.permissions, data.typeId, activeLink.identity != null);
		const create = {
			...data,
			data: stripDataUpdate(activeLink, data.typeId, data.data, activeLink.identity != null)
		};
		const result = await this.database.lines.createLine(mapData.id, create, {
			...internalOptions,
			identity: activeLink.identity
		});
		return stripLineOrThrow(activeLink, result);
	}

	async updateLine(mapSlug: AnyMapSlug | RawActiveMapLink, lineId: ID, data: Line<CRU.UPDATE_VALIDATED>, trackPointsFromRoute?: Route & { trackPoints: AsyncIterable<TrackPoint> }): Promise<Stripped<Line>> {
		const { activeLink, mapData } = await this.resolveMapSlug(mapSlug);

		const originalRawLine = await this.database.lines.getLine(mapData.id, lineId, { notFound404: true });

		checkUpdateObject(activeLink.permissions, originalRawLine.typeId, isOwn(activeLink, originalRawLine));
		if (data.typeId != null && data.typeId !== originalRawLine.typeId) {
			checkUpdateObject(activeLink.permissions, data.typeId, isOwn(activeLink, originalRawLine));
		}

		const newType = await this.getType(activeLink, data.typeId ?? originalRawLine.typeId);

		const update = {
			...data,
			...data.data ? { data: stripDataUpdate(activeLink, newType.id, data.data, isOwn(activeLink, originalRawLine)) } : {}
		};
		const result = await this.database.lines._updateLine(originalRawLine, update, newType, {
			trackPointsFromRoute,
			identity: activeLink.identity
		});
		return stripLineOrThrow(activeLink, result);
	}

	async deleteLine(mapSlug: AnyMapSlug | RawActiveMapLink, lineId: ID): Promise<void> {
		const { activeLink, mapData } = await this.resolveMapSlug(mapSlug);
		const rawLine = await this.database.lines.getLine(mapData.id, lineId, { notFound404: true });
		checkManageObject(activeLink.permissions, rawLine.typeId, isOwn(activeLink, rawLine));
		await this.database.lines._deleteLine(rawLine, { identity: activeLink.identity });
	}

	async exportLineAsGpx(mapSlug: AnyMapSlug | RawActiveMapLink, lineId: ID, options?: { rte?: boolean }): Promise<ExportResult> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);

		const line = stripLineOrThrow(activeLink, await this.database.lines.getLine(mapData.id, lineId, { notFound404: true }));
		const type = stripTypeOrThrow(activeLink, await this.database.types.getType(mapData.id, line.typeId));

		const filename = getSafeFilename(normalizeLineName(line.name));
		const data = (
			options?.rte ? exportLineToRouteGpx(line, type) :
			exportLineToTrackGpx(line, type, this.database.lines.getLinePointsForLine(line.id))
		);

		return {
			type: "application/gpx+xml",
			filename: `${filename}.gpx`,
			data: data.pipeThrough(new TextEncoderStream())
		};
	}

	async exportLineAsGeoJson(mapSlug: AnyMapSlug | RawActiveMapLink, lineId: ID): Promise<ExportResult> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);

		const line = stripLineOrThrow(activeLink, await this.database.lines.getLine(mapData.id, lineId, { notFound404: true }));
		const type = stripTypeOrThrow(activeLink, await this.database.types.getType(mapData.id, line.typeId));

		const filename = getSafeFilename(normalizeLineName(line.name));
		const data = exportLineToGeoJson(line, type, this.database.lines.getLinePointsForLine(line.id));

		return {
			type: "application/geo+json",
			filename: `${filename}.geojson`,
			data: data.pipeThrough(new TextEncoderStream())
		};
	}

	async getLineTemplate(mapSlug: AnyMapSlug | RawActiveMapLink, options: { typeId: ID }): Promise<LineTemplate> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		const rawType = await this.database.types.getType(mapData.id, options.typeId, { notFound404: true });
		const type = stripTypeOrThrow(activeLink, rawType);
		return getLineTemplate(type);
	}

	_getMapTypes(activeLink: RawActiveMapLink): AsyncIterable<Stripped<Type>> {
		return flatMapAsyncIterable(this.database.types.getTypes(activeLink.mapId), (type) => {
			const result = stripType(activeLink, type);
			return result ? [result] : [];
		});
	}

	async getMapTypes(mapSlug: AnyMapSlug | RawActiveMapLink): Promise<StreamedResults<Stripped<Type>>> {
		const { activeLink } = await this.resolveMapSlug(mapSlug);
		return {
			results: this._getMapTypes(activeLink)
		};
	}

	async getType(mapSlug: AnyMapSlug | RawActiveMapLink, typeId: ID): Promise<Stripped<Type>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		const rawType = await this.database.types.getType(mapData.id, typeId, { notFound404: true });
		return stripTypeOrThrow(activeLink, rawType);
	}

	async createType(mapSlug: AnyMapSlug | RawActiveMapLink, data: Type<CRU.CREATE_VALIDATED>, internalOptions?: { id?: ID }): Promise<Stripped<Type>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		checkConfigureMap(activeLink.permissions);
		const rawType = await this.database.types.createType(mapData.id, data, {
			...internalOptions,
			identity: activeLink.identity
		});
		return stripTypeOrThrow(activeLink, rawType);
	}

	async updateType(mapSlug: AnyMapSlug | RawActiveMapLink, typeId: ID, data: Type<CRU.UPDATE_VALIDATED>): Promise<Stripped<Type>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		checkUpdateType(activeLink.permissions, typeId);
		const rawType = await this.database.types.updateType(mapData.id, typeId, data, {
			notFound404: true,
			identity: activeLink.identity
		});
		return stripTypeOrThrow(activeLink, rawType);
	}

	async deleteType(mapSlug: AnyMapSlug | RawActiveMapLink, typeId: ID): Promise<void> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		checkUpdateType(activeLink.permissions, typeId);
		await this.database.types.deleteType(mapData.id, typeId, {
			notFound404: true,
			identity: activeLink.identity
		});
	}

	_getMapViews(activeLink: RawActiveMapLink): AsyncIterable<Stripped<View>> {
		return flatMapAsyncIterable(this.database.views.getViews(activeLink.mapId), (view) => {
			const result = stripView(activeLink, view);
			return result ? [result] : [];
		});
	}

	async getMapViews(mapSlug: AnyMapSlug | RawActiveMapLink): Promise<StreamedResults<Stripped<View>>> {
		const { activeLink } = await this.resolveMapSlug(mapSlug);
		return {
			results: this._getMapViews(activeLink)
		};
	}

	async getView(mapSlug: AnyMapSlug | RawActiveMapLink, viewId: ID): Promise<Stripped<View>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		const rawView = await this.database.views.getView(mapData.id, viewId, { notFound404: true });
		return stripViewOrThrow(activeLink, rawView);
	}

	async createView(mapSlug: AnyMapSlug | RawActiveMapLink, data: View<CRU.CREATE_VALIDATED>, internalOptions?: { id?: ID }): Promise<Stripped<View>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		checkConfigureMap(activeLink.permissions);
		const rawView = await this.database.views.createView(mapData.id, data, {
			...internalOptions,
			identity: activeLink.identity
		});
		return stripViewOrThrow(activeLink, rawView);
	}

	async updateView(mapSlug: AnyMapSlug | RawActiveMapLink, viewId: ID, data: View<CRU.UPDATE_VALIDATED>): Promise<Stripped<View>> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		checkConfigureMap(activeLink.permissions);
		const rawView = await this.database.views.updateView(mapData.id, viewId, data, {
			notFound404: true,
			identity: activeLink.identity
		});
		return stripViewOrThrow(activeLink, rawView);
	}

	async deleteView(mapSlug: AnyMapSlug | RawActiveMapLink, viewId: ID): Promise<void> {
		const { mapData, activeLink } = await this.resolveMapSlug(mapSlug);
		checkConfigureMap(activeLink.permissions);
		await this.database.views.deleteView(mapData.id, viewId, {
			notFound404: true,
			identity: activeLink.identity
		});
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
		const { permissions, noPassword } = z.object({
			permissions: stringifiedJsonValidator.pipe(mapPermissionsValidator),
			noPassword: stringifiedBooleanValidator.optional()
		}).parse(req.query);
		return [getRequestMapSlug(req), { permissions, noPassword }];
	}, "json"),

	exportMapAsGpx: apiImpl.get("/map/:mapSlug/gpx", (req) => {
		const { rte, filter } = z.object({
			rte: stringifiedBooleanValidator.optional(),
			filter: z.string().optional()
		}).parse(req.query);
		return [getRequestMapSlug(req), { rte, filter }];
	}, "export"),

	exportMapAsGpxZip: apiImpl.get("/map/:mapSlug/gpx/zip", (req) => {
		const { rte, filter } = z.object({
			rte: stringifiedBooleanValidator.optional(),
			filter: z.string().optional()
		}).parse(req.query);
		return [getRequestMapSlug(req), { rte, filter }];
	}, "export"),

	exportMapAsGeoJson: apiImpl.get("/map/:mapSlug/geojson", (req) => {
		const { filter } = z.object({
			filter: z.string().optional()
		}).parse(req.query);
		return [getRequestMapSlug(req), { filter }];
	}, "export"),

	exportMapAsTable: apiImpl.get("/map/:mapSlug/table", (req) => {
		const { typeId, filter, hide } = z.object({
			typeId: stringifiedIdValidator,
			filter: z.string().optional(),
			hide: z.string().optional()
		}).parse(req.query);
		return [getRequestMapSlug(req), { typeId, filter, hide: hide ? hide.split(",") : undefined }];
	}, "export"),

	exportMapAsCsv: apiImpl.get("/map/:mapSlug/csv", (req) => {
		const { typeId, filter, hide } = z.object({
			typeId: stringifiedIdValidator,
			filter: z.string().optional(),
			hide: z.string().optional()
		}).parse(req.query);
		return [getRequestMapSlug(req), { typeId, filter, hide: hide ? hide.split(",") : undefined }];
	}, "export"),

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

	exportLineAsGpx: apiImpl.get("/map/:mapSlug/line/:lineId/gpx", (req) => {
		const lineId = stringifiedIdValidator.parse(req.params.lineId);
		const { rte } = z.object({
			rte: stringifiedBooleanValidator.optional()
		}).parse(req.query);
		return [getRequestMapSlug(req), lineId, { rte }];
	}, "export"),

	exportLineAsGeoJson: apiImpl.get("/map/:mapSlug/line/:lineId/geojson", (req) => {
		const lineId = stringifiedIdValidator.parse(req.params.lineId);
		return [getRequestMapSlug(req), lineId];
	}, "export"),

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