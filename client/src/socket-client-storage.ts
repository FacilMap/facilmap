import {
	type ID, type Marker, type LineWithTrackPoints, type View, type Type, type HistoryEntry, type EventName,
	type EventHandler, type MapDataWithWritable, type MapSlug, type Route, type Line, type LinePoints,
	type RoutePoints, type DeepReadonly, fromEntries, entries, subscribeToMapDefaultPick, keys
} from "facilmap-types";
import { SocketClient, type ClientEvents } from "./socket-client";
import { DefaultReactiveObjectProvider, type ReactiveObjectProvider } from "./reactivity";
import { isInBbox, mergeTrackPoints } from "./utils";
import type { RouteWithTrackPoints } from "./socket-client-route-subscription";
import { SubscriptionStateType } from "./socket-client-subscription";

export interface MapStorage {
	mapData: DeepReadonly<MapDataWithWritable> | undefined;
	markers: Record<ID, DeepReadonly<Marker>>;
	lines: Record<ID, DeepReadonly<LineWithTrackPoints>>;
	views: Record<ID, DeepReadonly<View>>;
	types: Record<ID, DeepReadonly<Type>>;
	history: Record<ID, DeepReadonly<HistoryEntry>>;
};

export class SocketClientStorage {
	reactiveObjectProvider: ReactiveObjectProvider;
	client: SocketClient;

	maps: Record<MapSlug, MapStorage>;
	routes: Record<string, DeepReadonly<RouteWithTrackPoints>>;

	constructor(client: SocketClient, options?: { reactiveObjectProvider?: ReactiveObjectProvider }) {
		this.reactiveObjectProvider = options?.reactiveObjectProvider ?? new DefaultReactiveObjectProvider();
		this.client = client;
		this.maps = this.reactiveObjectProvider.makeReactive(Object.create(null));
		this.routes = this.reactiveObjectProvider.makeReactive(Object.create(null));

		for(const [i, handler] of Object.entries(this._getEventHandlers())) {
			this.client.on(i as any, handler as any);
		}
	}

	dispose(): void {
		for(const [i, handler] of Object.entries(this._getEventHandlers())) {
			this.client.removeListener(i as any, handler as any);
		}
		this.maps = this.reactiveObjectProvider.makeReactive({});
		this.routes = this.reactiveObjectProvider.makeReactive({});
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
					if (!this.client.bbox || isInBbox(data, this.client.bbox)) {
						this.storeMarker(mapSlug, data);
					} else {
						// The marker was moved out of the current bbox, clear it because we won’t receive updates for
						// it anymore and don’t want to have an outdated object in the store. (If the marker stays
						// in its new position, we will receive the newest version as soon as we pan there, but it might
						// be moved again and we don’t hear about it.)
						this.clearMarker(mapSlug, data.id);
					}
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

			linePoints: (mapSlug, { reset, ...linePoints }) => {
				if (this.maps[mapSlug]) {
					this.storeLinePoints(mapSlug, linePoints, reset);
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

					if(this.maps[mapSlug].mapData?.defaultViewId === data.id) {
						this.storeMapData(mapSlug, {
							...this.maps[mapSlug].mapData!,
							defaultView: null,
							defaultViewId: null
						});
					}
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

			route: (routeKey, data) => {
				this.storeRoute(routeKey, data);
			},

			routePoints: (routeKey, { reset, ...routePoints }) => {
				this.storeRoutePoints(routeKey, routePoints, reset);
			},

			emit: (...args) => {
				switch (args[0]) {
					case "subscribeToMap": {
						const mapSlug = args[1].args[0];
						const pick = args[1].args[1]?.pick ?? subscribeToMapDefaultPick;
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

						if (
							// Do not run when updating existing subscription
							this.client.mapSubscriptions[mapSlug]?.state.type !== SubscriptionStateType.SUBSCRIBED
						) {
							// Gracefully re-aggregate objects in case of a reconnect: First receive objects and put them into
							// the storage, and when all objects have arrived, delete the ones that are in the storage but were
							// not received this time. This way we don’t need to clear the storage (causing them to temporarily
							// disappear for the user on a reconnect), but still we catch deletions that happened while the
							// connection was gone.
							const getRecordedIds = recordReceivedIds(this.client, mapSlug);
							args[1].result.then(() => {
								const recordedIds = getRecordedIds();
								for (const key of keys(this.maps[mapSlug])) {
									if (key !== "mapData" && pick.includes(key as any)) {
										for (const id of keys(this.maps[mapSlug][key])) {
											if (!recordedIds[key].includes(Number(id))) {
												this.reactiveObjectProvider.delete(this.maps[mapSlug][key], id);
											}
										}
									}
								}
							}, () => {
								// Remove listeners in case of error
								getRecordedIds();
							});
						}
						break;
					}

					case "createMapAndSubscribe":
						this.reactiveObjectProvider.set(this.maps, args[1].args[0].adminId, {
							mapData: undefined,
							markers: {},
							lines: {},
							types: {},
							views: {},
							history: {}
						});
						break;

					case "unsubscribeFromMap":
						this.reactiveObjectProvider.delete(this.maps, args[1].args[0]);
						break;

					case "unsubscribeFromRoute":
						this.reactiveObjectProvider.delete(this.routes, args[1].args[0]);
						break;

					case "setBbox":
						if (this.client.bbox && args[1].args[0].zoom !== this.client.bbox.zoom) {
							// Reset line points on zoom change to prevent us from accumulating too many unneeded line points.
							// On zoom change the line points are sent from the server without applying the "except" rule for the last bbox,
							// so we can be sure that we will receive all line points that are relevant for the new bbox.

							const linesHandled = new Set<ID>();
							const linePointsHandler: EventHandler<ClientEvents, "linePoints"> = (mapSlug, data) => {
								linesHandled.add(data.lineId);
							};
							this.client.on("linePoints", linePointsHandler);

							args[1].result.finally(() => {
								this.client.removeListener("linePoints", linePointsHandler);
							}).catch((err) => console.error(err));

							args[1].result.then(() => {
								for (const [mapSlug, objs] of Object.entries(this.maps)) {
									for (const lineId_ of Object.keys(objs.lines)) {
										const lineId = Number(lineId_);
										if (!linesHandled.has(lineId)) {
											this.storeLinePoints(mapSlug, { lineId, trackPoints: [] }, true);
										}
									}
								}
							}).catch((err) => console.error(err));
						}

						if (this.client.bbox) {
							for (const [mapSlug, mapStorage] of Object.entries(this.maps)) {
								for (const marker of Object.values(mapStorage.markers)) {
									if (!isInBbox(marker, this.client.bbox)) {
										// The marker is outside the new bbox, clear it because we won’t receive updates for
										// it anymore and don’t want to have an outdated object in the store. (If the marker stays
										// in its position, we will receive the newest version as soon as we pan there again, but it
										// might be moved and we don’t hear about it.)
										this.clearMarker(mapSlug, marker.id);
									}
								}
							}
						}

						break;
				}
			}
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

	storeLine(mapSlug: MapSlug, line: DeepReadonly<Line>): void {
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
			trackPoints: mergeTrackPoints(reset ? {} : line.trackPoints, linePoints.trackPoints)
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
	}

	storeHistoryEntry(mapSlug: MapSlug, historyEntry: HistoryEntry): void {
		this.reactiveObjectProvider.set(this.getMapStorage(mapSlug).history, historyEntry.id, historyEntry);
	}

	clearHistoryEntry(mapSlug: MapSlug, historyEntryId: ID): void {
		this.reactiveObjectProvider.delete(this.getMapStorage(mapSlug).history, historyEntryId);
	}

	clearHistory(mapSlug: MapSlug): void {
		const mapStorage = this.getMapStorage(mapSlug);
		for (const id of keys(mapStorage.history)) {
			this.reactiveObjectProvider.delete(mapStorage.history, id);
		}
	}

	storeRoute(routeKey: string, route: Route): void {
		this.reactiveObjectProvider.set(this.routes, routeKey, {
			...route,
			trackPoints: this.routes[routeKey]?.trackPoints || { length: 0 }
		});
	}

	storeRoutePoints(routeKey: string, routePoints: RoutePoints, reset: boolean): void {
		const route = this.routes[routeKey];
		if (!route) {
			throw new Error(`Route ${routeKey} is not in storage.`);
		}

		this.reactiveObjectProvider.set(this.routes, routeKey, {
			...route,
			trackPoints: mergeTrackPoints(reset ? {} : route.trackPoints, routePoints.trackPoints)
		});
	}

}

const recordTypesByEvent = { marker: "markers", line: "lines", type: "types", view: "views", history: "history" } as const;

function recordReceivedIds(client: SocketClient, mapSlug: MapSlug): () => Record<typeof recordTypesByEvent[keyof typeof recordTypesByEvent], ID[]> {
	const received = fromEntries(Object.values(recordTypesByEvent).map((t) => [t, [] as ID[]]));
	const handlers = fromEntries(entries(recordTypesByEvent).map(([e, t]) => [e, (slug: MapSlug, obj: { id: ID }) => {
		if (slug === mapSlug) {
			received[t].push(obj.id);
		}
	}]));
	for (const [t, handler] of entries(handlers)) {
		client.on(t, handler);
	}

	return () => {
		for (const [t, handler] of entries(handlers)) {
			client.removeListener(t, handler);
		}
		return received;
	};
}