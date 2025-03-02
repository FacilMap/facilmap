import {
	ApiVersion, CRU, type AllAdminMapObjectsItem, type AllMapObjectsItem, type AllMapObjectsPick, type Api, type Bbox,
	type BboxWithExcept, type BboxWithZoom, type ExportFormat, type FindMapsResult, type FindOnMapResult,
	type HistoryEntry, type ID, type Line, type LineWithTrackPoints, type MapData, type MapDataWithWritable,
	type MapSlug, type Marker, type PagedResults, type PagingInput, type RouteInfo, type RouteRequest,
	type SearchResult, type StreamedResults, type TrackPoint, type Type, type View
} from "facilmap-types";
import {
	JsonDeserializer, JsonParser, JsonPathDetector, JsonPathSelector, JsonPathStreamSplitter, deserializeJsonValue,
	parseJsonStream, streamToIterable
} from "json-stream-es";
import { parse as parseContentDisposition } from "content-disposition";
import { flatMapAsyncIterable } from "./utils";

function parseStreamedResults<T>(res: Response): StreamedResults<T> {
	return {
		results: streamToIterable(
			res.body!.pipeThrough(new TextDecoderStream())
				.pipeThrough(parseJsonStream(["results"])) as ReadableStream<any>
		)
	};
}

function parseAllMapObjects(res: Response): AsyncIterable<AllMapObjectsItem<AllMapObjectsPick>> {
	return flatMapAsyncIterable(streamToIterable(
		res.body!
			.pipeThrough(new TextDecoderStream())
			.pipeThrough(new JsonParser())
			.pipeThrough(new JsonPathDetector())
			.pipeThrough(new JsonPathSelector([undefined]))
			.pipeThrough(new JsonPathStreamSplitter())
	), async (stream): Promise<Array<AllMapObjectsItem<AllMapObjectsPick>>> => {
		const type = stream.path[0]
		switch (type) {
			case "mapData":
				return [{ type, data: (await deserializeJsonValue(stream)) as any }];
			case "markers":
			case "lines":
			case "linePoints":
			case "types":
			case "views":
				return [{
					type,
					data: flatMapAsyncIterable(streamToIterable(
						stream
							.pipeThrough(new JsonPathSelector([undefined]))
							.pipeThrough(new JsonDeserializer())
					), (it) => [it.value as any])
				}];
			default:
				stream.cancel().catch(() => undefined);
				return [];
		}
	});
}

function encodeStringArray(arr: string[]): string {
	return arr.join(",");
}

export class RestClient implements Api<ApiVersion.V3, false> {
	baseUrl: string;
	fetchImpl: typeof fetch;

	constructor(server: string, options: { fetch?: typeof fetch } = {}) {
		this.baseUrl = `${server.endsWith("/") ? server.slice(0, -1) : server}/_api/${ApiVersion.V3}`;
		this.fetchImpl = options.fetch ?? fetch;
	}

	protected async fetch(path: string, init?: Omit<RequestInit, "body"> & { query?: Record<string, string | number | undefined>; body?: BodyInit | object }): Promise<Response> {
		const { query, body, ...rest } = init ?? {};

		const urlWithoutQuery = `${this.baseUrl}${path}`;
		const queryString = `${new URLSearchParams(Object.fromEntries(Object.entries(query ?? {}).flatMap(([k, v]) => v != null ? [[k, `${v}`]] : [])))}`;
		const url = `${urlWithoutQuery}${queryString ? `${urlWithoutQuery.includes("?") ? "&" : "?"}${queryString}` : ""}`;

		const resolvedInit: RequestInit = { ...rest };
		if (body && body.constructor === Object) {
			resolvedInit.headers = new Headers(resolvedInit.headers);
			if (!resolvedInit.headers.has("Content-type")) {
				resolvedInit.headers.set("Content-type", "application/json");
			}
			resolvedInit.body = JSON.stringify(body);
		} else {
			resolvedInit.body = body as BodyInit;
		}

		const res = await this.fetchImpl(url, resolvedInit);

		if (!res.ok) {
			let responseBody: string | undefined = undefined;
			try {
				responseBody = await res.text();
			} catch {
				// Ignore
			}

			throw new Error(`Request to ${url} failed with status ${res.status}${responseBody ? `\n${responseBody}`: ""}`);
		}

		return res;
	}

	async findMaps(query: string, data?: PagingInput): Promise<PagedResults<FindMapsResult>> {
		const res = await this.fetch("/map", { query: { query, ...data } });
		return await res.json();
	}

	async getMap(mapSlug: MapSlug): Promise<MapDataWithWritable> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}`);
		return await res.json();
	}

	async createMap<Pick extends AllMapObjectsPick = "mapData" | "types">(data: MapData<CRU.CREATE>, options?: { pick?: Pick[]; bbox?: BboxWithZoom }): Promise<AsyncIterable<AllAdminMapObjectsItem<Pick>>> {
		const res = await this.fetch("/map", {
			method: "POST",
			query: {
				pick: options?.pick?.join(","),
				bbox: options?.bbox && JSON.stringify(options?.bbox)
			},
			body: data
		});
		return parseAllMapObjects(res) as AsyncIterable<AllAdminMapObjectsItem<Pick>>;
	}

	async updateMap(mapSlug: MapSlug, data: MapData<CRU.UPDATE>): Promise<MapDataWithWritable> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}`, {
			method: "PUT",
			body: data
		});
		return await res.json();
	}

	async deleteMap(mapSlug: MapSlug): Promise<void> {
		await this.fetch(`/map/${encodeURIComponent(mapSlug)}`, {
			method: "DELETE"
		});
	}

	async getAllMapObjects<Pick extends AllMapObjectsPick>(mapSlug: MapSlug, options?: { pick?: Pick[]; bbox?: BboxWithExcept }): Promise<AsyncIterable<AllMapObjectsItem<Pick>>> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/all`, {
			query: {
				...options?.pick ? {
					pick: encodeStringArray(options.pick)
				} : {},
				...options?.bbox ? {
					bbox: JSON.stringify(options.bbox)
				} : {}
			}
		});
		return parseAllMapObjects(res) as AsyncIterable<AllMapObjectsItem<Pick>>;
	}

	async findOnMap(mapSlug: MapSlug, query: string): Promise<FindOnMapResult[]> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/find`, {
			query: {
				query
			}
		});
		return await res.json();
	}

	async getHistory(mapSlug: MapSlug, data?: PagingInput): Promise<HistoryEntry[]> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/history`, {
			query: data
		});
		return await res.json();
	}

	async revertHistoryEntry(mapSlug: MapSlug, historyEntryId: ID): Promise<void> {
		await this.fetch(`/map/${encodeURIComponent(mapSlug)}/history/${encodeURIComponent(historyEntryId)}/revert`, {
			method: "POST"
		});
	}

	async getMapMarkers(mapSlug: MapSlug, options?: { bbox?: BboxWithExcept; typeId?: ID }): Promise<StreamedResults<Marker>> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/marker`, {
			query: {
				...options?.bbox ? {
					bbox: JSON.stringify(options.bbox)
				} : {},
				...options?.typeId != null ? {
					typeId: options.typeId
				} : {}
			}
		});
		return await res.json();
	}

	async getMarker(mapSlug: MapSlug, markerId: ID): Promise<Marker> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/marker/${encodeURIComponent(markerId)}`);
		return await res.json();
	}

	async createMarker(mapSlug: MapSlug, data: Marker<CRU.CREATE>): Promise<Marker> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/marker`, {
			method: "POST",
			body: data
		});
		return await res.json();
	}

	async updateMarker(mapSlug: MapSlug, markerId: ID, data: Marker<CRU.UPDATE>): Promise<Marker> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/marker/${encodeURIComponent(markerId)}`, {
			method: "PUT",
			body: data
		});
		return await res.json();
	}

	async deleteMarker(mapSlug: MapSlug, markerId: ID): Promise<void> {
		await this.fetch(`/map/${encodeURIComponent(mapSlug)}/marker/${encodeURIComponent(markerId)}`, { method: "DELETE" });
	}

	async getMapLines<IncludeTrackPoints extends boolean = false>(mapSlug: MapSlug, options?: { bbox?: BboxWithZoom; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }): Promise<StreamedResults<IncludeTrackPoints extends true ? LineWithTrackPoints : Line>> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/line`, {
			query: {
				...options?.bbox ? {
					bbox: JSON.stringify(options.bbox)
				} : {},
				...options?.includeTrackPoints ? {
					includeTrackPoints: JSON.stringify(options.includeTrackPoints)
				} : {},
				...options?.typeId != null ? {
					typeId: options.typeId
				} : {}
			}
		});
		return parseStreamedResults(res);
	}

	async getLine(mapSlug: MapSlug, lineId: ID): Promise<Line> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/line/${encodeURIComponent(lineId)}`);
		return await res.json();
	}

	async getLinePoints(mapSlug: MapSlug, lineId: ID, options?: { bbox?: BboxWithZoom & { except?: Bbox } }): Promise<StreamedResults<TrackPoint>> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/line/${encodeURIComponent(lineId)}/linePoints`, {
			query: {
				...options?.bbox ? {
					bbox: JSON.stringify(options.bbox)
				} : {}
			}
		});
		return parseStreamedResults(res);
	}

	async createLine(mapSlug: MapSlug, data: Line<CRU.CREATE>): Promise<Line> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/line`, {
			method: "POST",
			body: data
		});
		return await res.json();
	}

	async updateLine(mapSlug: MapSlug, lineId: ID, data: Line<CRU.UPDATE>): Promise<Line> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/line/${encodeURIComponent(lineId)}`, {
			method: "PUT",
			body: data
		});
		return await res.json();
	}

	async deleteLine(mapSlug: MapSlug, lineId: ID): Promise<void> {
		await this.fetch(`/map/${encodeURIComponent(mapSlug)}/line/${encodeURIComponent(lineId)}`, {
			method: "DELETE"
		});
	}

	async exportLine(mapSlug: MapSlug, lineId: ID, options: { format: ExportFormat }): Promise<{ type: string; filename: string; data: ReadableStream<string> }> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/line/${encodeURIComponent(lineId)}/export`, {
			query: {
				format: options.format
			}
		});
		return {
			type: res.headers.get("Content-type")!,
			filename: parseContentDisposition(res.headers.get("Content-disposition")!).parameters.filename,
			data: res.body!.pipeThrough(new TextDecoderStream())
		};
	}

	async getMapTypes(mapSlug: MapSlug): Promise<StreamedResults<Type>> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/type`);
		return parseStreamedResults(res);
	}

	async getType(mapSlug: MapSlug, typeId: ID): Promise<Type> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/type/${encodeURIComponent(typeId)}`);
		return await res.json();
	}

	async createType(mapSlug: MapSlug, data: Type<CRU.CREATE>): Promise<Type> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/type`, {
			method: "POST",
			body: data
		});
		return await res.json();
	}

	async updateType(mapSlug: MapSlug, typeId: ID, data: Type<CRU.UPDATE>): Promise<Type> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/type/${encodeURIComponent(typeId)}`, {
			method: "PUT",
			body: data
		});
		return await res.json();
	}

	async deleteType(mapSlug: MapSlug, typeId: ID): Promise<void> {
		await this.fetch(`/map/${encodeURIComponent(mapSlug)}/type/${encodeURIComponent(typeId)}`, {
			method: "DELETE"
		});
	}

	async getMapViews(mapSlug: MapSlug): Promise<StreamedResults<View>> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/view`);
		return parseStreamedResults(res);
	}

	async getView(mapSlug: MapSlug, viewId: ID): Promise<View> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/view/${encodeURIComponent(viewId)}`);
		return await res.json();
	}

	async createView(mapSlug: MapSlug, data: View<CRU.CREATE>): Promise<View> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/view`, {
			method: "POST",
			body: data
		});
		return await res.json();
	}

	async updateView(mapSlug: MapSlug, viewId: ID, data: View<CRU.UPDATE>): Promise<View> {
		const res = await this.fetch(`/map/${encodeURIComponent(mapSlug)}/view/${encodeURIComponent(viewId)}`, {
			method: "PUT",
			body: data
		});
		return await res.json();
	}

	async deleteView(mapSlug: MapSlug, viewId: ID): Promise<void> {
		await this.fetch(`/map/${encodeURIComponent(mapSlug)}/view/${encodeURIComponent(viewId)}`, {
			method: "DELETE"
		});
	}

	async find(query: string): Promise<SearchResult[]> {
		const res = await this.fetch("/find", {
			query: {
				query
			}
		});
		return await res.json();
	}

	async findUrl(url: string): Promise<{ data: ReadableStream<string> }> {
		const res = await this.fetch("/find/url", {
			query: {
				url
			}
		});
		return {
			data: res.body!.pipeThrough(new TextDecoderStream())
		};
	}

	async getRoute(data: RouteRequest): Promise<RouteInfo> {
		const res = await this.fetch("/route", {
			query: {
				destinations: JSON.stringify(data.destinations),
				mode: data.mode
			}
		});
		return await res.json();
	}

	async geoip(): Promise<Bbox | undefined> {
		const res = await this.fetch("/geoip");
		if (res.status === 204) {
			return undefined;
		} else {
			return await res.json();
		}
	}
}