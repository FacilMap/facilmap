import type { MapData, Writable, ID, Marker, LineWithTrackPoints, View, Type, HistoryEntry, EventName, EventHandler, MultipleEvents, MultipleEvents, SocketEvents, SocketVersion, BboxWithZoom, LinePointsEvent, MapDataWithWritable } from "facilmap-types";
import type { ClientEvents, ClientEvents, RouteWithTrackPoints } from "./socket";
import Client from "./socket";

export interface ClientData {
	mapData: MapDataWithWritable | undefined;
	markers: Record<ID, Marker>;
	lines: Record<ID, LineWithTrackPoints>;
	views: Record<ID, View>;
	types: Record<ID, Type>;
	history: Record<ID, HistoryEntry>;
	routes: Record<string, RouteWithTrackPoints>;
}

export default class StoringClient extends Client {
	data: ClientData;

	constructor(server: string, mapId?: string, options?: ConstructorParameters<typeof Client>[2]) {
		super(server, mapId, options);

		this.data = this.reactiveObjectProvider.create({
			mapData: undefined,
			markers: {},
			lines: {},
			views: {},
			types: {},
			history: {},
			routes: {}
		});
	}

	protected override _getEventHandlers(): {
		[E in EventName<ClientEvents>]?: EventHandler<ClientEvents, E>
	} {
		const handlers = super._getEventHandlers();

		return {
			...handlers,

			mapData: (data) => {
				handlers.mapData?.(data);

				this.reactiveObjectProvider.set(this.data, 'mapData', data);
			},

			marker: (data) => {
				this.reactiveObjectProvider.set(this.data.markers, data.id, data);
			},

			deleteMarker: (data) => {
				this.reactiveObjectProvider.delete(this.data.markers, data.id);
			},

			line: (data) => {
				this.reactiveObjectProvider.set(this.data.lines, data.id, {
					...data,
					trackPoints: this.data.lines[data.id]?.trackPoints || { length: 0 }
				});
			},

			deleteLine: (data) => {
				this.reactiveObjectProvider.delete(this.data.lines, data.id);
			},

			linePoints: (data) => {
				const line = this.data.lines[data.id];
				if(line == null)
					return console.error("Received line points for non-existing line "+data.id+".");

				this.reactiveObjectProvider.set(line, 'trackPoints', this._mergeTrackPoints(data.reset ? {} : line.trackPoints, data.trackPoints));
			},

			routePoints: (data) => {
				if(!this.data.route) {
					console.error("Received route points for non-existing route.");
					return;
				}

				this.reactiveObjectProvider.set(this.data.route, 'trackPoints', this._mergeTrackPoints(this.data.route.trackPoints, data));
			},

			routePointsWithId: (data) => {
				const route = this.data.routes[data.routeId];
				if(!route) {
					console.error("Received route points for non-existing route.");
					return;
				}

				this.reactiveObjectProvider.set(route, 'trackPoints', this._mergeTrackPoints(route.trackPoints, data.trackPoints));
			},

			view: (data) => {
				this.reactiveObjectProvider.set(this.data.views, data.id, data);
			},

			deleteView: (data) => {
				this.reactiveObjectProvider.delete(this.data.views, data.id);
				if (this.data.mapData) {
					if(this.data.mapData.defaultViewId == data.id)
						this.reactiveObjectProvider.set(this.data.mapData, 'defaultViewId', null);
				}
			},

			type: (data) => {
				this.reactiveObjectProvider.set(this.data.types, data.id, data);
			},

			deleteType: (data) => {
				this.reactiveObjectProvider.delete(this.data.types, data.id);
			},

			disconnect: (reason) => {
				handlers.disconnect?.(reason);
				this.reactiveObjectProvider.set(this.data, 'markers', { });
				this.reactiveObjectProvider.set(this.data, 'lines', { });
				this.reactiveObjectProvider.set(this.data, 'views', { });
				this.reactiveObjectProvider.set(this.data, 'history', { });
			},

			history: (data) => {
				this.reactiveObjectProvider.set(this.data.history, data.id, data);
				// TODO: Limit to 50 entries
			}
		};
	};

	protected override async _updateBbox(bbox: BboxWithZoom): Promise<MultipleEvents<SocketEvents<SocketVersion.V3>>> {
		const isZoomChange = this.bbox && bbox.zoom !== this.bbox.zoom;

		const obj = await super._updateBbox(bbox);

		if (isZoomChange) {
			// Reset line points on zoom change to prevent us from accumulating too many unneeded line points.
			// On zoom change the line points are sent from the server without applying the "except" rule for the last bbox,
			// so we can be sure that we will receive all line points that are relevant for the new bbox.
			obj.linePoints = obj.linePoints || [];
			const linePointEventsById = new Map(obj.linePoints.map((e): [number, LinePointsEvent] => [e.id, e])); // Cannot use "as const" due to https://github.com/microsoft/rushstack/issues/3875
			for (const lineIdStr of Object.keys(this.data.lines)) {
				const lineId = Number(lineIdStr);
				const e = linePointEventsById.get(lineId);
				if (e) {
					e.reset = true;
				} else {
					obj.linePoints.push({
						id: lineId,
						trackPoints: [],
						reset: true
					});
				}
			}
		}

		return obj;
	}

	get mapData(): MapDataWithWritable | undefined {
		return this.data.mapData;
	}

	get markers(): Record<ID, Marker> {
		return this.data.markers;
	}

	get lines(): Record<ID, LineWithTrackPoints> {
		return this.data.lines;
	}

	get views(): Record<ID, View> {
		return this.data.views;
	}

	get types(): Record<ID, Type> {
		return this.data.types;
	}

	get history(): Record<ID, HistoryEntry> {
		return this.data.history;
	}

	get routes(): Record<string, RouteWithTrackPoints> {
		return this.data.routes;
	}
}