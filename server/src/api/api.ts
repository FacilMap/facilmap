import { type HistoryEntry, type Paging, type SearchResult, type RouteInfo, Writable, type MapData, type MapSlug, CRU, type MapDataWithWritable, type AllMapObjectsItem, type PagedResults, type FindMapsResult, type BboxWithZoom, type Bbox, type Api, type ID, type FindOnMapResult, type Line, type TrackPoint, type Route, type ExportFormat, type Type, type View, type Marker, type RouteRequest, type AllAdminMapObjectsItem, type StreamedResults, type AllMapObjectsPick, type ReplaceProperties, type BboxWithExcept, type LineWithTrackPoints, type LinePoints, type AllMapObjectsTypes } from "facilmap-types";
import type Database from "../database/database";
import { getI18n } from "../i18n";
import { asyncIteratorToArray } from "../utils/streams";
import { omit } from "lodash-es";
import { exportLineToRouteGpx, exportLineToTrackGpx } from "../export/gpx";
import { findQuery, findUrl } from "../search";
import { calculateRoute } from "../routing/routing";
import { geoipLookup } from "../geoip";

export class ApiBackend implements Api<true> {
	protected database: Database;
	protected remoteAddr: string | undefined;

	constructor(database: Database, remoteAddr: string | undefined) {
		this.database = database;
		this.remoteAddr = remoteAddr;
	}

	protected async resolveMapSlug(mapSlug: MapSlug, minimumPermissions: Writable): Promise<MapDataWithWritable> {
		const map = await this.database.maps.getMapDataByAnyId(mapSlug);
		if (!map) {
			throw Object.assign(new Error(getI18n().t("api.map-not-exist-error")), { status: 404 });
		}
		const writable = map.adminId === mapSlug ? Writable.ADMIN : map.writeId === mapSlug ? Writable.WRITE : Writable.READ;

		if (minimumPermissions === Writable.ADMIN && ![Writable.ADMIN].includes(writable))
			throw new Error(getI18n().t("api.only-in-admin-error"));
		else if (minimumPermissions === Writable.WRITE && ![Writable.ADMIN, Writable.WRITE].includes(writable))
			throw new Error(getI18n().t("api.only-in-write-error"));

		if (writable === Writable.ADMIN) {
			return { ...map, writable };
		} else if (writable === Writable.WRITE) {
			return { ...omit(map, ["adminId"]), writable };
		} else {
			return { ...omit(map, ["adminId", "writeId"]), writable };
		}
	}

	protected async* getMapObjectsUntyped<M extends MapDataWithWritable = MapDataWithWritable>(
		mapData: M,
		{ pick, bbox }: { pick: AllMapObjectsPick[]; bbox?: BboxWithZoom }
	): AsyncIterable<ReplaceProperties<AllMapObjectsTypes, { mapData: ["mapData", M] }>[AllMapObjectsPick]> {
		if (pick.includes("mapData")) {
			yield ["mapData", mapData];
		}

		if (pick.includes("types")) {
			for await (const type of this._getMapTypes(mapData)) {
				yield ["type", type];
			}
		}

		if (pick.includes("views")) {
			for await (const view of this._getMapViews(mapData)) {
				yield ["view", view];
			}
		}

		if (pick.includes("markers")) {
			for await (const marker of this._getMapMarkers(mapData, { bbox })) {
				yield ["marker", marker];
			}
		}

		if (pick.includes("lines") || pick.includes("linesWithTrackPoints")) {
			for await (const line of this._getMapLines(mapData, { includeTrackPoints: pick.includes("linesWithTrackPoints"), bbox })) {
				yield ["line", line];
			}
		}

		if (pick.includes("linePoints")) {
			for await (const linePoints of this._getMapLinePoints(mapData, { bbox })) {
				yield ["linePoints", linePoints];
			}
		}
	}

	protected getMapObjects<Pick extends AllMapObjectsPick, M extends MapDataWithWritable = MapDataWithWritable>(
		mapData: M,
		{ pick, bbox }: { pick: Pick[]; bbox?: BboxWithZoom }
	): AsyncIterable<ReplaceProperties<AllMapObjectsTypes, { mapData: ["mapData", M] }>[Pick]> {
		return this.getMapObjectsUntyped(mapData, { pick: pick as AllMapObjectsPick[], bbox }) as AsyncIterable<ReplaceProperties<AllMapObjectsTypes, { mapData: ["mapData", M] }>[Pick]>;
	}

	async findMaps(query: string, data: Paging): Promise<PagedResults<FindMapsResult>> {
		return await this.database.maps.findMaps({ ...data, query });
	}

	async getMap(mapSlug: string): Promise<MapDataWithWritable> {
		return await this.resolveMapSlug(mapSlug, Writable.READ);
	}

	async createMap<Pick extends AllMapObjectsPick = "mapData" | "types">(data: MapData<CRU.CREATE_VALIDATED>, options?: { pick?: Pick[]; bbox?: BboxWithZoom }): Promise<StreamedResults<AllAdminMapObjectsItem<Pick>>> {
		const mapData = await this.database.maps.createMap(data);
		return {
			results: this.getMapObjects({ ...mapData, writable: Writable.ADMIN }, { ...options, pick: options?.pick ?? ["mapData", "types"] as Pick[] })
		};
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

	async getAllMapObjects<Pick extends AllMapObjectsPick>(mapSlug: MapSlug, options: { pick: Pick[]; bbox?: BboxWithZoom }): Promise<StreamedResults<AllMapObjectsItem<Pick>>> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return {
			results: this.getMapObjects(mapData, options)
		};
	}

	async findOnMap(mapSlug: MapSlug, query: string): Promise<FindOnMapResult[]> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return await this.database.search.search(mapData.id, query);
	}

	async getHistory(mapSlug: MapSlug, data: Paging): Promise<HistoryEntry[]> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);

		return await asyncIteratorToArray(this.database.history.getHistory(mapData.id, mapData.writable === Writable.ADMIN ? undefined : ["Marker", "Line"]));
	}

	async revertHistoryEntry(mapSlug: MapSlug, historyEntryId: ID): Promise<void> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);

		const historyEntry = await this.database.history.getHistoryEntry(mapData.id, historyEntryId);

		if(!["Marker", "Line"].includes(historyEntry.type) && mapData.writable != Writable.ADMIN)
			throw new Error(getI18n().t("api.admin-revert-error"));

		await this.database.history.revertHistoryEntry(mapData.id, historyEntryId);
	}

	protected _getMapMarkers(mapData: MapDataWithWritable, options?: { bbox?: BboxWithExcept }): AsyncIterable<Marker> {
		return this.database.markers.getMapMarkers(mapData.id, options?.bbox);
	}

	async getMapMarkers(mapSlug: MapSlug, options?: { bbox?: BboxWithExcept }): Promise<StreamedResults<Marker>> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);

		return {
			results: this._getMapMarkers(mapData, options)
		};
	}

	async getMarker(mapSlug: MapSlug, markerId: ID): Promise<Marker> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return await this.database.markers.getMarker(mapData.id, markerId);
	}

	async createMarker(mapSlug: MapSlug, data: Marker<CRU.CREATE_VALIDATED>): Promise<Marker> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);
		return await this.database.markers.createMarker(mapData.id, data);
	}

	async updateMarker(mapSlug: MapSlug, markerId: ID, data: Marker<CRU.UPDATE_VALIDATED>): Promise<Marker> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);
		return await this.database.markers.updateMarker(mapData.id, markerId, data);
	}

	async deleteMarker(mapSlug: MapSlug, markerId: ID): Promise<void> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);
		await this.database.markers.deleteMarker(mapData.id, markerId);
	}

	async* _getMapLines<IncludeTrackPoints extends boolean = false>(mapData: MapDataWithWritable, options?: { bbox?: BboxWithZoom, includeTrackPoints?: IncludeTrackPoints }): AsyncIterable<IncludeTrackPoints extends true ? LineWithTrackPoints : Line> {
		for await (const line of this.database.lines.getMapLines(mapData.id)) {
			if (options?.includeTrackPoints) {
				const trackPoints = await asyncIteratorToArray(this.database.lines.getLinePointsForLine(line.id, options?.bbox));
				yield { ...line, trackPoints } as LineWithTrackPoints;
			} else {
				yield line as IncludeTrackPoints extends true ? LineWithTrackPoints : Line;
			}
		}
	}

	_getMapLinePoints(mapData: MapDataWithWritable, options?: { bbox?: BboxWithZoom }): AsyncIterable<LinePoints> {
		return this.database.lines.getLinePointsForMap(mapData.id, options?.bbox);
	}

	async getMapLines<IncludeTrackPoints extends boolean = false>(mapSlug: MapSlug, options?: { bbox?: BboxWithZoom, includeTrackPoints?: IncludeTrackPoints }): Promise<StreamedResults<IncludeTrackPoints extends true ? LineWithTrackPoints : Line>> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return {
			results: this._getMapLines(mapData, options)
		};
	}

	async getLine(mapSlug: MapSlug, lineId: ID): Promise<Line> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return await this.database.lines.getLine(mapData.id, lineId);
	}

	async getLinePoints(mapSlug: MapSlug, lineId: ID, bbox?: BboxWithZoom): Promise<StreamedResults<TrackPoint>> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		const line = await this.database.lines.getLine(mapData.id, lineId);
		return {
			results: this.database.lines.getLinePointsForLine(line.id, bbox)
		};
	}

	async createLine(mapSlug: MapSlug, data: Line<CRU.CREATE_VALIDATED>, trackPointsFromRoute?: Route): Promise<Line> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);
		return await this.database.lines.createLine(mapData.id, data, trackPointsFromRoute);
	}

	async updateLine(mapSlug: MapSlug, lineId: ID, data: Line<CRU.UPDATE_VALIDATED>, trackPointsFromRoute?: Route): Promise<Line> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);
		return await this.database.lines.updateLine(mapData.id, lineId, data, undefined, trackPointsFromRoute);
	}

	async deleteLine(mapSlug: MapSlug, lineId: ID): Promise<void> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.WRITE);
		await this.database.lines.deleteLine(mapData.id, lineId);
	}

	async exportLine(mapSlug: MapSlug, lineId: ID, options: { format: ExportFormat }): Promise<{ data: ReadableStream<string> }> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);

		const lineP = this.database.lines.getLine(mapData.id, lineId);
		lineP.catch(() => null); // Avoid unhandled promise error (https://stackoverflow.com/a/59062117/242365)

		const [line, type] = await Promise.all([
			lineP,
			lineP.then((line) => this.database.types.getType(mapData.id, line.typeId))
		]);

		switch(options.format) {
			case "gpx-trk":
				return { data: exportLineToTrackGpx(line, type, this.database.lines.getLinePointsForLine(line.id)) as ReadableStream<string> };
			case "gpx-rte":
				return { data: exportLineToRouteGpx(line, type) as ReadableStream<string> };
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

	async getType (mapSlug: MapSlug, id: ID): Promise<Type> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return await this.database.types.getType(mapData.id, id);
	}

	async createType(mapSlug: MapSlug, data: Type<CRU.CREATE_VALIDATED>): Promise<Type> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		return await this.database.types.createType(mapData.id, data);
	}

	async updateType(mapSlug: MapSlug, id: ID, data: Type<CRU.UPDATE_VALIDATED>): Promise<Type> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		return await this.database.types.updateType(mapData.id, id, data);
	}

	async deleteType(mapSlug: MapSlug, id: ID): Promise<void> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		await this.database.types.deleteType(mapData.id, id);
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

	async getView(mapSlug: MapSlug, id: ID): Promise<View> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.READ);
		return await this.database.views.getView(mapData.id, id);
	}

	async createView(mapSlug: MapSlug, data: View<CRU.CREATE_VALIDATED>): Promise<View> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		return await this.database.views.createView(mapData.id, data);
	}

	async updateView(mapSlug: MapSlug, id: ID, data: View<CRU.UPDATE_VALIDATED>): Promise<View> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		return await this.database.views.updateView(mapData.id, id, data);
	}

	async deleteView(mapSlug: MapSlug, id: ID): Promise<void> {
		const mapData = await this.resolveMapSlug(mapSlug, Writable.ADMIN);
		await this.database.views.deleteView(mapData.id, id);
	}

	async find(query: string): Promise<SearchResult[]> {
		return await findQuery(query);
	}

	async findUrl(url: string): Promise<{ data: ReadableStream<string> }> {
		const result = await findUrl(url);
		return { data: result.data as ReadableStream<string> };
	}

	async getRoute(data: RouteRequest): Promise<RouteInfo> {
		return await calculateRoute(data.destinations, data.mode);
	}

	async geoip(): Promise<Bbox | undefined> {
		return this.remoteAddr ? await geoipLookup(this.remoteAddr) : undefined;
	}
}