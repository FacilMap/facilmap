import type {
	ID, Marker, LineWithTrackPoints, View, Type, HistoryEntry, EventName, EventHandler, BboxWithZoom, MapDataWithWritable,
	MapSlug, TrackPoint, TrackPoints, Route, Line, LineToRouteRequest, RouteParameters, SubscribeToMapPick, LinePoints,
	RoutePoints,
	DeepReadonly
} from "facilmap-types";
import { SocketClient, type ClientEvents } from "./socket-client";
import { getReactiveObjectProvider, type ReactiveObjectProvider } from "./reactivity";

export interface MapStorage {
	mapData: DeepReadonly<MapDataWithWritable> | undefined;
	markers: Record<ID, DeepReadonly<Marker>>;
	lines: Record<ID, DeepReadonly<LineWithTrackPoints>>;
	views: Record<ID, DeepReadonly<View>>;
	types: Record<ID, DeepReadonly<Type>>;
	history: Record<ID, DeepReadonly<HistoryEntry>>;
};

export type RouteWithTrackPoints = Omit<Route, "routeId" | "trackPoints"> & { trackPoints: TrackPoints };

export class SocketClientStorage {
	reactiveObjectProvider: ReactiveObjectProvider = getReactiveObjectProvider();
	client: SocketClient;

	maps: Record<MapSlug, MapStorage>;
	routes: Record<string, RouteWithTrackPoints>;

	constructor(client: SocketClient) {
		this.client = client;
		this.maps = this.reactiveObjectProvider.create({});
		this.routes = this.reactiveObjectProvider.create({});

		for(const [i, handler] of Object.entries(this._getEventHandlers())) {
			this.client.on(i as any, handler as any);
		}
	}

	dispose(): void {
		for(const [i, handler] of Object.entries(this._getEventHandlers())) {
			this.client.removeListener(i as any, handler as any);
		}
		this.reactiveObjectProvider.set(this, "maps", {});
		this.reactiveObjectProvider.set(this, "routes", {});
	}

	protected _getEventHandlers(): {
		[E in EventName<ClientEvents>]?: EventHandler<ClientEvents, E>
	} {
		return {
			mapData: (mapSlug, data) => {
				if (this.maps[mapSlug]) {
					this.storeMapData(mapSlug, data);
				}
			},

			marker: (mapSlug, data) => {
				if (this.maps[mapSlug]) {
					this.storeMarker(mapSlug, data);
				}
			},

			deleteMarker: (mapSlug, data) => {
				if (this.maps[mapSlug]) {
					this.clearMarker(mapSlug, data.id);
				}
			},

			line: (mapSlug, data) => {
				if (this.maps[mapSlug]) {
					this.storeLine(mapSlug, data);
				}
			},

			deleteLine: (mapSlug, data) => {
				if (this.maps[mapSlug]) {
					this.clearLine(mapSlug, data.id);
				}
			},

			linePoints: (mapSlug, data) => {
				if (this.maps[mapSlug]) {
					this.storeLinePoints(mapSlug, data, true);
				}
			},

			view: (mapSlug, data) => {
				if (this.maps[mapSlug]) {
					this.storeView(mapSlug, data);
				}
			},

			deleteView: (mapSlug, data) => {
				if (this.maps[mapSlug]) {
					this.clearView(mapSlug, data.id);
				}
			},

			type: (mapSlug, data) => {
				if (this.maps[mapSlug]) {
					this.storeType(mapSlug, data);
				}
			},

			deleteType: (mapSlug, data) => {
				if (this.maps[mapSlug]) {
					this.clearType(mapSlug, data.id);
				}
			},

			history: (mapSlug, data) => {
				if (this.maps[mapSlug]) {
					this.storeHistoryEntry(mapSlug, data);
				}
			},

			disconnect: (reason) => {
				this.reactiveObjectProvider.set(this, 'maps', { });
				this.reactiveObjectProvider.set(this, 'routes', { });
			},
		};
	};


	protected getMapStorage(mapSlug: MapSlug): MapStorage {
		if (!this.maps[mapSlug]) {
			throw new Error(`Map ${mapSlug} is not in storage.`);
		}
		return this.maps[mapSlug];
	}

	storeMapData(mapSlug: MapSlug, mapData: MapDataWithWritable): void {
		this.reactiveObjectProvider.set(this.getMapStorage(mapSlug), "mapData", mapData);
	}

	storeMarker(mapSlug: MapSlug, marker: Marker): void {
		this.reactiveObjectProvider.set(this.getMapStorage(mapSlug).markers, marker.id, marker);
	}

	clearMarker(mapSlug: MapSlug, markerId: ID): void {
		this.reactiveObjectProvider.delete(this.getMapStorage(mapSlug).markers, markerId);
	}

	storeLine(mapSlug: MapSlug, line: Line): void {
		this.reactiveObjectProvider.set(this.getMapStorage(mapSlug).lines, line.id, {
			...line,
			trackPoints: this.maps[mapSlug].lines[line.id]?.trackPoints || { length: 0 }
		});
	}

	storeLinePoints(mapSlug: MapSlug, linePoints: LinePoints, reset: boolean): void {
		const line = this.getMapStorage(mapSlug).lines[linePoints.lineId];
		if (!line) {
			console.error(`Received line points for non-existing line ${linePoints.lineId}.`);
			return;
		}

		this.reactiveObjectProvider.set(this.getMapStorage(mapSlug).lines, linePoints.lineId, {
			...line,
			trackPoints: this._mergeTrackPoints(reset ? {} : line.trackPoints, linePoints.trackPoints)
		});
	}

	clearLine(mapSlug: MapSlug, lineId: ID): void {
		this.reactiveObjectProvider.delete(this.getMapStorage(mapSlug).lines, lineId);
	}

	storeType(mapSlug: MapSlug, type: Type): void {
		this.reactiveObjectProvider.set(this.getMapStorage(mapSlug).types, type.id, type);
	}

	clearType(mapSlug: MapSlug, typeId: ID): void {
		this.reactiveObjectProvider.delete(this.getMapStorage(mapSlug).types, typeId);
	}

	storeView(mapSlug: MapSlug, view: View): void {
		this.reactiveObjectProvider.set(this.getMapStorage(mapSlug).views, view.id, view);
	}

	clearView(mapSlug: MapSlug, viewId: ID): void {
		this.reactiveObjectProvider.delete(this.getMapStorage(mapSlug).views, viewId);
		if(this.maps[mapSlug].mapData?.defaultViewId === viewId) {
			this.reactiveObjectProvider.set(this.maps[mapSlug].mapData!, 'defaultViewId', null);
		}
	}

	storeHistoryEntry(mapSlug: MapSlug, historyEntry: HistoryEntry): void {
		this.reactiveObjectProvider.set(this.getMapStorage(mapSlug).history, historyEntry.id, historyEntry);
		// TODO: Limit to 50 entries
	}

	clearHistoryEntry(mapSlug: MapSlug, historyEntryId: ID): void {
		this.reactiveObjectProvider.delete(this.getMapStorage(mapSlug).history, historyEntryId);
	}

	storeRoutePoints(routeKey: string, routePoints: RoutePoints, reset: boolean): void {
		const route = this.routes[routeKey];
		if (!route) {
			throw new Error(`Route ${routeKey} is not in storage.`);
		}

		this.reactiveObjectProvider.set(this.routes, routePoints.routeKey, {
			...route,
			trackPoints: this._mergeTrackPoints(reset ? {} : route.trackPoints, routePoints.trackPoints)
		});
	}


	async subscribeToMap(mapSlug: MapSlug, options?: { pick?: SubscribeToMapPick[]; history?: boolean }): Promise<void> {
		if (!this.maps[mapSlug]) {
			this.reactiveObjectProvider.set(this.maps, mapSlug, {
				mapData: undefined,
				markers: {},
				lines: {},
				types: {},
				views: {},
				history: {}
			});
		}

		const results = await this.client.subscribeToMap(mapSlug, options);
		for await (const obj of results) {
			if (obj.type === "mapData") {
				this.storeMapData(mapSlug, obj.data);
			} else if (obj.type === "markers") {
				for await (const marker of obj.data) {
					this.storeMarker(mapSlug, marker);
				}
			} else if (obj.type === "lines") {
				for await (const line of obj.data) {
					this.storeLine(mapSlug, line);
				}
			} else if (obj.type === "linePoints") {
				for await (const linePoints of obj.data) {
					this.storeLinePoints(mapSlug, linePoints, true);
				}
			} else if (obj.type === "types") {
				for await (const type of obj.data) {
					this.storeType(mapSlug, type);
				}
			} else if (obj.type === "views") {
				for await (const view of obj.data) {
					this.storeView(mapSlug, view);
				}
			}
		}
	}

	async unsubscribeFromMap(mapSlug: MapSlug): Promise<void> {
		this.reactiveObjectProvider.delete(this.maps, mapSlug);
		await this.client.unsubscribeFromMap(mapSlug);
	}

	async subscribeToRoute(routeKey: string, params: RouteParameters | LineToRouteRequest): Promise<void> {
		const result = await this.client.subscribeToRoute(routeKey, params);
		if (result) {
			this.reactiveObjectProvider.set(this.routes, routeKey, {
				...result,
				trackPoints: this._mergeTrackPoints({}, result.trackPoints)
			});
		}
	}

	async unsubscribeFromRoute(routeKey: string): Promise<void> {
		this.reactiveObjectProvider.delete(this.routes, routeKey);
		await this.client.unsubscribeFromRoute(routeKey);
	}

	async setBbox(bbox: BboxWithZoom): Promise<void> {
		const isZoomChange = !!this.client.bbox && bbox.zoom !== this.client.bbox.zoom;

		const results = await this.client.setBbox(bbox);

		const linesHandled = new Set<ID>();

		for await (const obj of results) {
			if (obj.type === "markers") {
				for await (const marker of obj.data) {
					this.storeMarker(obj.mapSlug, marker);
				}
			} else if (obj.type === "linePoints") {
				for await (const linePoints of obj.data) {
					this.storeLinePoints(obj.mapSlug, linePoints, isZoomChange);
					linesHandled.add(linePoints.lineId);
				}
			} else if (obj.type === "routePoints") {
				for await (const routePoints of obj.data) {
					this.storeRoutePoints(routePoints.routeKey, routePoints, isZoomChange);
				}
			}
		}

		if (isZoomChange) {
			// Reset line points on zoom change to prevent us from accumulating too many unneeded line points.
			// On zoom change the line points are sent from the server without applying the "except" rule for the last bbox,
			// so we can be sure that we will receive all line points that are relevant for the new bbox.
			for (const [mapSlug, objs] of Object.entries(this.maps)) {
				for (const lineId_ of Object.keys(objs.lines)) {
					const lineId = Number(lineId_);
					if (!linesHandled.has(lineId)) {
						this.storeLinePoints(mapSlug, { lineId, trackPoints: [] }, true);
					}
				}
			}
		}
	}

	private _mergeTrackPoints(existingTrackPoints: Record<number, TrackPoint> | null, newTrackPoints: TrackPoint[]): TrackPoints {
		const ret = { ...(existingTrackPoints || { }) } as TrackPoints;

		for(let i=0; i<newTrackPoints.length; i++) {
			ret[newTrackPoints[i].idx] = newTrackPoints[i];
		}

		ret.length = 0;
		for(const i in ret) {
			if(i != "length")
				ret.length = Math.max(ret.length, parseInt(i) + 1);
		}

		return ret;
	}
}