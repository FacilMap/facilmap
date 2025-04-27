import {
	ApiVersion, CRU, Units, type AllMapObjects, type AllMapObjectsItem, type AllMapObjectsPick, type AnyMapSlug,
	type Api, type Bbox, type BboxWithExcept, type BboxWithZoom, type ExportFormat, type FindMapsResult,
	type FindOnMapResult, type HistoryEntry, type ID, type Line, type LineTemplate, type LineWithTrackPoints,
	type MapData, type MapPermissions, type Marker, type PagedResults, type PagingInput, type RouteInfo,
	type RouteRequest, type SearchResult, type StreamedResults, type Stripped, type TrackPoint, type Type, type View
} from "facilmap-types";
import {
	JsonDeserializer, JsonParser, JsonPathDetector, JsonPathSelector, JsonPathStreamSplitter, deserializeJsonValue,
	parseJsonStream, streamToIterable
} from "json-stream-es";
import { parse as parseContentDisposition } from "content-disposition";
import { flatMapAsyncIterable } from "./utils";
import { deserializeError } from "serialize-error";

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
	query: { lang?: string;  units?: Units } | undefined;

	constructor(server: string, options?: { fetch?: typeof fetch, query?: RestClient["query"] }) {
		this.baseUrl = `${server.endsWith("/") ? server.slice(0, -1) : server}/_api/${ApiVersion.V3}`;
		this.fetchImpl = options?.fetch ?? fetch;
		this.query = options?.query;
	}

	protected async fetch(path: string, init?: Omit<RequestInit, "body"> & { query?: Record<string, string | number | undefined>; body?: BodyInit | object }): Promise<Response> {
		const { query, body, ...rest } = init ?? {};

		const urlWithoutQuery = `${this.baseUrl}${path}`;
		const queryString = `${new URLSearchParams(Object.fromEntries(Object.entries({
			...this.query ?? {},
			...query ?? {}
		}).flatMap(([k, v]) => v != null ? [[k, `${v}`]] : [])))}`;
		const url = `${urlWithoutQuery}${queryString ? `${urlWithoutQuery.includes("?") ? "&" : "?"}${queryString}` : ""}`;

		const resolvedInit: RequestInit & { headers: Headers } = {
			...rest,
			headers: new Headers(rest.headers)
		};
		if (body && body.constructor === Object) {
			if (!resolvedInit.headers.has("Content-type")) {
				resolvedInit.headers.set("Content-type", "application/json");
			}
			resolvedInit.body = JSON.stringify(body);
		} else {
			resolvedInit.body = body as BodyInit;
		}

		const res = await this.fetchImpl(url, resolvedInit);

		if (!res.ok) {
			if (res.headers.has("X-FacilMap-Error")) {
				const cause = deserializeError(JSON.parse(res.headers.get("X-FacilMap-Error")!));
				throw Object.assign(new Error(`${resolvedInit.method?.toUpperCase() ?? "GET"} ${url} failed with status ${res.status} (${cause.message})`, { cause }), {
					status: (cause as any).status
				});
			} else {
				let responseBody: string | undefined = undefined;
				try {
					responseBody = await res.text();
				} catch {
					// Ignore
				}

				throw Object.assign(new Error(`${resolvedInit.method?.toUpperCase() ?? "GET"} ${url} failed with status ${res.status}${responseBody ? `\n${responseBody}`: ""}`), {
					status: res.status
				});
			}
		}

		return res;
	}

	protected async fetchMap(anyMapSlug: AnyMapSlug, path: (mapSlug: string) => string, init?: Omit<RequestInit, "body"> & { query?: Record<string, string | number | undefined>; body?: BodyInit | object }): Promise<Response> {
		const { mapSlug, password, identity } = typeof anyMapSlug === "string" ? { mapSlug: anyMapSlug } : anyMapSlug;
		return await this.fetch(path(mapSlug), {
			...init,
			...password != null ? {
				headers: (() => {
					const headers = new Headers(init?.headers);
					headers.set("Authorization", `Basic ${btoa(unescape(encodeURIComponent(`:${password}`)))}`);
					return headers;
				})()
			} : {},
			...identity != null ? {
				query: {
					identity,
					...init?.query
				}
			} : {}
		});
	}

	async findMaps(query: string, data?: PagingInput): Promise<PagedResults<FindMapsResult>> {
		const res = await this.fetch("/map", { query: { query, ...data } });
		return await res.json();
	}

	async getMap(mapSlug: AnyMapSlug): Promise<Stripped<MapData>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}`);
		return await res.json();
	}

	protected async _createMap(data: MapData<CRU.CREATE>, options?: { pick?: AllMapObjectsPick[]; bbox?: BboxWithZoom }): Promise<Response> {
		return await this.fetch("/map", {
			method: "POST",
			query: {
				pick: options?.pick?.join(","),
				bbox: options?.bbox && JSON.stringify(options?.bbox)
			},
			body: data
		})
	}

	async createMap<Pick extends AllMapObjectsPick = "mapData" | "types">(data: MapData<CRU.CREATE>, options?: { pick?: Pick[]; bbox?: BboxWithZoom }): Promise<AsyncIterable<AllMapObjectsItem<Pick>>> {
		const res = await this._createMap(data, options);
		return parseAllMapObjects(res) as AsyncIterable<AllMapObjectsItem<Pick>>;
	}

	async createMapUnstreamed<Pick extends AllMapObjectsPick = "mapData" | "types">(data: MapData<CRU.CREATE>, options?: { pick?: Pick[]; bbox?: BboxWithZoom }): Promise<AllMapObjects<Pick>> {
		const res = await this._createMap(data, options);
		return await res.json();
	}

	async updateMap(mapSlug: AnyMapSlug, data: MapData<CRU.UPDATE>): Promise<Stripped<MapData>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}`, {
			method: "PUT",
			body: data
		});
		return await res.json();
	}

	async deleteMap(mapSlug: AnyMapSlug): Promise<void> {
		await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}`, {
			method: "DELETE"
		});
	}

	async _getAllMapObjects<Pick extends AllMapObjectsPick>(mapSlug: AnyMapSlug, options?: { pick?: Pick[]; bbox?: BboxWithExcept }): Promise<Response> {
		return await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/all`, {
			query: {
				...options?.pick ? {
					pick: encodeStringArray(options.pick)
				} : {},
				...options?.bbox ? {
					bbox: JSON.stringify(options.bbox)
				} : {}
			}
		});
	}

	async getAllMapObjects<Pick extends AllMapObjectsPick>(mapSlug: AnyMapSlug, options?: { pick?: Pick[]; bbox?: BboxWithExcept }): Promise<AsyncIterable<AllMapObjectsItem<Pick>>> {
		return parseAllMapObjects(await this._getAllMapObjects(mapSlug, options)) as AsyncIterable<AllMapObjectsItem<Pick>>;
	}

	async getAllMapObjectsUnstreamed<Pick extends AllMapObjectsPick>(mapSlug: AnyMapSlug, options?: { pick?: Pick[]; bbox?: BboxWithExcept }): Promise<AllMapObjects<Pick>> {
		const res = await this._getAllMapObjects(mapSlug, options);
		return await res.json();
	}

	async findOnMap(mapSlug: AnyMapSlug, query: string): Promise<Array<Stripped<FindOnMapResult>>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/find`, {
			query: {
				query
			}
		});
		return await res.json();
	}

	async getMapToken(mapSlug: AnyMapSlug, options: { permissions: MapPermissions, noPassword?: boolean }): Promise<{ token: string }> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/token`);
		return await res.json();
	}

	async getHistory(mapSlug: AnyMapSlug, data?: PagingInput): Promise<PagedResults<Stripped<HistoryEntry>>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/history`, {
			query: data
		});
		return await res.json();
	}

	async revertHistoryEntry(mapSlug: AnyMapSlug, historyEntryId: ID): Promise<void> {
		await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/history/${encodeURIComponent(historyEntryId)}/revert`, {
			method: "POST"
		});
	}

	async getMapMarkers(mapSlug: AnyMapSlug, options?: { bbox?: BboxWithExcept; typeId?: ID }): Promise<StreamedResults<Stripped<Marker>>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/marker`, {
			query: {
				...options?.bbox ? {
					bbox: JSON.stringify(options.bbox)
				} : {},
				...options?.typeId != null ? {
					typeId: options.typeId
				} : {}
			}
		});
		return parseStreamedResults(res);
	}

	async getMarker(mapSlug: AnyMapSlug, markerId: ID): Promise<Stripped<Marker>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/marker/${encodeURIComponent(markerId)}`);
		return await res.json();
	}

	async createMarker(mapSlug: AnyMapSlug, data: Marker<CRU.CREATE>): Promise<Stripped<Marker>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/marker`, {
			method: "POST",
			body: data
		});
		return await res.json();
	}

	async updateMarker(mapSlug: AnyMapSlug, markerId: ID, data: Marker<CRU.UPDATE>): Promise<Stripped<Marker>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/marker/${encodeURIComponent(markerId)}`, {
			method: "PUT",
			body: data
		});
		return await res.json();
	}

	async deleteMarker(mapSlug: AnyMapSlug, markerId: ID): Promise<void> {
		await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/marker/${encodeURIComponent(markerId)}`, { method: "DELETE" });
	}

	async getMapLines<IncludeTrackPoints extends boolean = false>(mapSlug: AnyMapSlug, options?: { bbox?: BboxWithZoom; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }): Promise<StreamedResults<IncludeTrackPoints extends true ? Stripped<LineWithTrackPoints> : Stripped<Line>>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/line`, {
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

	async getLine(mapSlug: AnyMapSlug, lineId: ID): Promise<Stripped<Line>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/line/${encodeURIComponent(lineId)}`);
		return await res.json();
	}

	async getLinePoints(mapSlug: AnyMapSlug, lineId: ID, options?: { bbox?: BboxWithExcept }): Promise<StreamedResults<TrackPoint>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/line/${encodeURIComponent(lineId)}/linePoints`, {
			query: {
				...options?.bbox ? {
					bbox: JSON.stringify(options.bbox)
				} : {}
			}
		});
		return parseStreamedResults(res);
	}

	async createLine(mapSlug: AnyMapSlug, data: Line<CRU.CREATE>): Promise<Stripped<Line>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/line`, {
			method: "POST",
			body: data
		});
		return await res.json();
	}

	async updateLine(mapSlug: AnyMapSlug, lineId: ID, data: Line<CRU.UPDATE>): Promise<Stripped<Line>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/line/${encodeURIComponent(lineId)}`, {
			method: "PUT",
			body: data
		});
		return await res.json();
	}

	async deleteLine(mapSlug: AnyMapSlug, lineId: ID): Promise<void> {
		await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/line/${encodeURIComponent(lineId)}`, {
			method: "DELETE"
		});
	}

	async exportLine(mapSlug: AnyMapSlug, lineId: ID, options: { format: ExportFormat }): Promise<{ type: string; filename: string; data: ReadableStream<Uint8Array> }> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/line/${encodeURIComponent(lineId)}/export`, {
			query: {
				format: options.format
			}
		});
		return {
			type: res.headers.get("Content-type")!,
			filename: parseContentDisposition(res.headers.get("Content-disposition")!).parameters.filename,
			data: res.body!
		};
	}

	async getLineTemplate(mapSlug: AnyMapSlug, options: { typeId: ID }): Promise<LineTemplate> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/line/template`, {
			query: {
				typeId: options.typeId
			}
		});
		return await res.json();
	}

	async getMapTypes(mapSlug: AnyMapSlug): Promise<StreamedResults<Stripped<Type>>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/type`);
		return parseStreamedResults(res);
	}

	async getType(mapSlug: AnyMapSlug, typeId: ID): Promise<Stripped<Type>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/type/${encodeURIComponent(typeId)}`);
		return await res.json();
	}

	async createType(mapSlug: AnyMapSlug, data: Type<CRU.CREATE>): Promise<Stripped<Type>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/type`, {
			method: "POST",
			body: data
		});
		return await res.json();
	}

	async updateType(mapSlug: AnyMapSlug, typeId: ID, data: Type<CRU.UPDATE>): Promise<Stripped<Type>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/type/${encodeURIComponent(typeId)}`, {
			method: "PUT",
			body: data
		});
		return await res.json();
	}

	async deleteType(mapSlug: AnyMapSlug, typeId: ID): Promise<void> {
		await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/type/${encodeURIComponent(typeId)}`, {
			method: "DELETE"
		});
	}

	async getMapViews(mapSlug: AnyMapSlug): Promise<StreamedResults<Stripped<View>>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/view`);
		return parseStreamedResults(res);
	}

	async getView(mapSlug: AnyMapSlug, viewId: ID): Promise<Stripped<View>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/view/${encodeURIComponent(viewId)}`);
		return await res.json();
	}

	async createView(mapSlug: AnyMapSlug, data: View<CRU.CREATE>): Promise<Stripped<View>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/view`, {
			method: "POST",
			body: data
		});
		return await res.json();
	}

	async updateView(mapSlug: AnyMapSlug, viewId: ID, data: View<CRU.UPDATE>): Promise<Stripped<View>> {
		const res = await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/view/${encodeURIComponent(viewId)}`, {
			method: "PUT",
			body: data
		});
		return await res.json();
	}

	async deleteView(mapSlug: AnyMapSlug, viewId: ID): Promise<void> {
		await this.fetchMap(mapSlug, (s) => `/map/${encodeURIComponent(s)}/view/${encodeURIComponent(viewId)}`, {
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

	async findUrl(url: string): Promise<{ data: ReadableStream<Uint8Array> }> {
		const res = await this.fetch("/find/url", {
			query: {
				url
			}
		});
		return {
			data: res.body!
		};
	}

	async getRoute(data: RouteRequest): Promise<RouteInfo> {
		const res = await this.fetch("/route", {
			query: {
				destinations: JSON.stringify(data.routePoints),
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