import type { AllMapObjectsItem, AllMapObjectsPick, Bbox, BboxWithExcept, BboxWithZoom, CRU, DeepReadonly, EventHandler, EventName, ExportFormat, FindOnMapResult, HistoryEntry, ID, Line, LinePoints, LineWithTrackPoints, MapData, MapDataWithWritable, MapSlug, Marker, PagingInput, SocketApi, SocketVersion, StreamedResults, SubscribeToMapOptions, TrackPoint, Type, View } from "facilmap-types";
import { type ClientEvents, type SocketClient } from "./socket-client";
import { type ReactiveObjectProvider } from "./reactivity";
import { mergeEventHandlers, mergeTrackPoints } from "./utils";
import { SocketClientSubscription, type SubscriptionState } from "./socket-client-subscription";

type SocketClientMapSubscriptionInterface = {
	[K in (
		| "getMap" | "updateMap" | "deleteMap" | "getAllMapObjects" | "findOnMap" | "getHistory"
		| "revertHistoryEntry" | "getMapMarkers" | "getMarker" | "createMarker" | "updateMarker" | "deleteMarker"
		| "getMapLines" | "getLine" | "getLinePoints" | "createLine" | "updateLine" | "deleteLine" | "exportLine"
		| "getMapTypes" | "getType" | "createType" | "updateType" | "deleteType" | "getMapViews" | "getView"
		| "createView" | "updateView" | "deleteView"
	)]: SocketApi<SocketVersion.V3, false>[K] extends (...args: infer Args) => infer Result ? (Args extends [MapSlug, ...infer Rest] ? (...args: Rest) => Result : never) : never;

	// This would be simpler:
	// SocketApi<SocketVersion.V3, false>[K] extends (mapSlug: MapSlug, ...args: infer Args) => (...args: Args) => Result : never;
	// but it does not work and infers Args to never if it is a union.
	// This seems to be a TypeScript bug, reported here: https://github.com/microsoft/TypeScript/issues/48663#issuecomment-2187713647
};

declare const write: unique symbol;
declare global {
	interface WritableStreamDefaultWriter<W = any> {
		[write]?: (a: W) => void;
	}
}

const test: WritableStream<{ a: string }> = new WritableStream<{ a: string; b: string }>();

const writable = new WritableStream<{ a: string; b: string }>();
void new ReadableStream<{ a: string }>().pipeTo(writable); // No error

export enum MapSubscriptionStateType {
	/** The map has been deleted. */
	DELETED = "deleted"
};

export type MapSubscriptionState = SubscriptionState
	| { type: MapSubscriptionStateType.DELETED };

export interface MapSubscriptionData {
	state: DeepReadonly<MapSubscriptionState>,
	mapSlug: MapSlug;
	options: DeepReadonly<SubscribeToMapOptions>;
	mapData: DeepReadonly<MapDataWithWritable> | undefined;
	markers: Record<ID, DeepReadonly<Marker>>;
	lines: Record<ID, DeepReadonly<LineWithTrackPoints>>;
	views: Record<ID, DeepReadonly<View>>;
	types: Record<ID, DeepReadonly<Type>>;
	history: Record<ID, DeepReadonly<HistoryEntry>>;
};

export interface SocketClientMapSubscription extends Readonly<MapSubscriptionData> {
	// Getters are defined in SocketClientSubscription
}

export class SocketClientMapSubscription extends SocketClientSubscription<MapSubscriptionData> implements SocketClientMapSubscriptionInterface {
	constructor(client: SocketClient, mapSlug: MapSlug, options?: SubscribeToMapOptions & {
		reactiveObjectProvider?: ReactiveObjectProvider;
	}) {
		const { reactiveObjectProvider, ...mapOptions } = options ?? {};

		super(client, {
			reactiveObjectProvider,
			mapSlug,
			options: mapOptions,
			mapData: undefined,
			markers: {},
			lines: {},
			types: {},
			views: {},
			history: {}
		});
	}

	protected override async _doSubscribe(): Promise<void> {
		await this.client._subscribeToMap(this.mapSlug, this.data.options);
	}

	async updateSubscription(options: SubscribeToMapOptions): Promise<void> {
		this.reactiveObjectProvider.set(this.data, "options", options);
		await this._subscribe();
	}

	protected override async _doUnsubscribe(): Promise<void> {
		await this.client._unsubscribeFromMap(this.mapSlug);
	}

	storeMapData(mapData: MapDataWithWritable): void {
		this.reactiveObjectProvider.set(this.data, "mapData", mapData);
	}

	storeMarker(marker: Marker): void {
		this.reactiveObjectProvider.set(this.data.markers, marker.id, marker);
	}

	clearMarker(markerId: ID): void {
		this.reactiveObjectProvider.delete(this.data.markers, markerId);
	}

	storeLine(line: Line): void {
		this.reactiveObjectProvider.set(this.data.lines, line.id, {
			...line,
			trackPoints: this.data.lines[line.id]?.trackPoints || { length: 0 }
		});
	}

	storeLinePoints(linePoints: LinePoints, reset: boolean): void {
		const line = this.data.lines[linePoints.lineId];
		if (!line) {
			console.error(`Received line points for non-existing line ${linePoints.lineId}.`);
			return;
		}

		this.reactiveObjectProvider.set(this.data.lines, linePoints.lineId, {
			...line,
			trackPoints: mergeTrackPoints(reset ? {} : line.trackPoints, linePoints.trackPoints)
		});
	}

	clearLine(lineId: ID): void {
		this.reactiveObjectProvider.delete(this.data.lines, lineId);
	}

	storeType(type: Type): void {
		this.reactiveObjectProvider.set(this.data.types, type.id, type);
	}

	clearType(typeId: ID): void {
		this.reactiveObjectProvider.delete(this.data.types, typeId);
	}

	storeView(view: View): void {
		this.reactiveObjectProvider.set(this.data.views, view.id, view);
	}

	clearView(viewId: ID): void {
		this.reactiveObjectProvider.delete(this.data.views, viewId);
		if(this.data.mapData?.defaultViewId === viewId) {
			this.reactiveObjectProvider.set(this.data, "mapData", {
				...this.data.mapData!,
				defaultView: null,
				defaultViewId: null
			});
		}
	}

	storeHistoryEntry(historyEntry: HistoryEntry): void {
		this.reactiveObjectProvider.set(this.data.history, historyEntry.id, historyEntry);
		// TODO: Limit to 50 entries
	}

	clearHistoryEntry(historyEntryId: ID): void {
		this.reactiveObjectProvider.delete(this.data.history, historyEntryId);
	}

	protected _getEventHandlers(): {
		[E in EventName<ClientEvents>]?: EventHandler<ClientEvents, E>
	} {
		return mergeEventHandlers(super._getEventHandlers(), {
			mapSlugRename: (slugMap) => {
				if (slugMap[this.data.mapSlug]) {
					this.data.mapSlug = slugMap[this.data.mapSlug];
				}
			},

			mapData: (mapSlug, data) => {
				if (mapSlug === this.data.mapSlug) {
					this.storeMapData(data);
				}
			},

			deleteMap: (mapSlug) => {
				if (mapSlug === this.data.mapSlug) {
					this.reactiveObjectProvider.set(this.data, "state", { type: MapSubscriptionStateType.DELETED });
				}
			},

			marker: (mapSlug, data) => {
				if (mapSlug === this.data.mapSlug) {
					this.storeMarker(data);
				}
			},

			deleteMarker: (mapSlug, data) => {
				if (mapSlug === this.data.mapSlug) {
					this.clearMarker(data.id);
				}
			},

			line: (mapSlug, data) => {
				if (mapSlug === this.data.mapSlug) {
					this.storeLine(data);
				}
			},

			deleteLine: (mapSlug, data) => {
				if (mapSlug === this.data.mapSlug) {
					this.clearLine(data.id);
				}
			},

			linePoints: (mapSlug, data) => {
				if (mapSlug === this.data.mapSlug) {
					this.storeLinePoints(data, data.reset);
				}
			},

			view: (mapSlug, data) => {
				if (mapSlug === this.data.mapSlug) {
					this.storeView(data);
				}
			},

			deleteView: (mapSlug, data) => {
				if (mapSlug === this.data.mapSlug) {
					this.clearView(data.id);
				}
			},

			type: (mapSlug, data) => {
				if (mapSlug === this.data.mapSlug) {
					this.storeType(data);
				}
			},

			deleteType: (mapSlug, data) => {
				if (mapSlug === this.data.mapSlug) {
					this.clearType(data.id);
				}
			},

			history: (mapSlug, data) => {
				if (mapSlug === this.data.mapSlug) {
					this.storeHistoryEntry(data);
				}
			}
		});
	};

	async getMap(): Promise<MapDataWithWritable> {
		return await this.client.getMap(this.data.mapSlug);
	}

	async updateMap(data: MapData<CRU.UPDATE>): Promise<MapDataWithWritable> {
		return await this.client.updateMap(this.data.mapSlug, data);
	}

	async deleteMap(): Promise<void> {
		await this.client.deleteMap(this.data.mapSlug);
	}

	async getAllMapObjects<Pick extends AllMapObjectsPick>(options?: { pick?: Pick[]; bbox?: BboxWithExcept }): Promise<AsyncGenerator<AllMapObjectsItem<Pick>, void, undefined>> {
		return await this.client.getAllMapObjects(this.data.mapSlug, options);
	}

	async findOnMap(query: string): Promise<FindOnMapResult[]> {
		return await this.client.findOnMap(this.data.mapSlug, query);
	}

	async getHistory(data?: PagingInput): Promise<HistoryEntry[]> {
		return await this.client.getHistory(this.data.mapSlug, data);
	}

	async revertHistoryEntry(historyEntryId: ID): Promise<void> {
		await this.client.revertHistoryEntry(this.data.mapSlug, historyEntryId);
	}

	async getMapMarkers(options?: { bbox?: BboxWithExcept; typeId?: ID }): Promise<StreamedResults<Marker>> {
		return await this.client.getMapMarkers(this.data.mapSlug, options);
	}

	async getMarker(markerId: ID): Promise<Marker> {
		return await this.client.getMarker(this.data.mapSlug, markerId);
	}

	async createMarker(data: Marker<CRU.CREATE>): Promise<Marker> {
		return await this.client.createMarker(this.data.mapSlug, data);
	}

	async updateMarker(markerId: ID, data: Marker<CRU.UPDATE>): Promise<Marker> {
		return await this.client.updateMarker(this.data.mapSlug, markerId, data);
	}

	async deleteMarker(markerId: ID): Promise<void> {
		await this.client.deleteMarker(this.data.mapSlug, markerId);
	}

	async getMapLines<IncludeTrackPoints extends boolean = false>(options?: { bbox?: BboxWithZoom; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }): Promise<StreamedResults<IncludeTrackPoints extends true ? LineWithTrackPoints : Line>> {
		return await this.client.getMapLines(this.data.mapSlug, options);
	}

	async getLine(lineId: ID): Promise<Line> {
		return await this.client.getLine(this.data.mapSlug, lineId);
	}

	async getLinePoints(lineId: ID, options?: { bbox?: BboxWithZoom & { except?: Bbox } }): Promise<StreamedResults<TrackPoint>> {
		return await this.client.getLinePoints(this.data.mapSlug, lineId, options);
	}

	async createLine(data: Line<CRU.CREATE>): Promise<Line> {
		return await this.client.createLine(this.data.mapSlug, data);
	}

	async updateLine(lineId: ID, data: Line<CRU.UPDATE>): Promise<Line> {
		return await this.client.updateLine(this.data.mapSlug, lineId, data);
	}

	async deleteLine(lineId: ID): Promise<void> {
		await this.client.deleteLine(this.data.mapSlug, lineId);
	}

	async exportLine(lineId: ID, options: { format: ExportFormat }): Promise<{ type: string; filename: string; data: ReadableStream<string> }> {
		return await this.client.exportLine(this.data.mapSlug, lineId, options);
	}

	async getMapTypes(): Promise<StreamedResults<Type>> {
		return await this.client.getMapTypes(this.data.mapSlug);
	}

	async getType(typeId: ID): Promise<Type> {
		return await this.client.getType(this.data.mapSlug, typeId);
	}

	async createType(data: Type<CRU.CREATE>): Promise<Type> {
		return await this.client.createType(this.data.mapSlug, data);
	}

	async updateType(typeId: ID, data: Type<CRU.UPDATE>): Promise<Type> {
		return await this.client.updateType(this.data.mapSlug, typeId, data);
	}

	async deleteType(typeId: ID): Promise<void> {
		await this.client.deleteType(this.data.mapSlug, typeId);
	}

	async getMapViews(): Promise<StreamedResults<View>> {
		return await this.client.getMapViews(this.data.mapSlug);
	}

	async getView(viewId: ID): Promise<View> {
		return await this.client.getView(this.data.mapSlug, viewId);
	}

	async createView(data: View<CRU.CREATE>): Promise<View> {
		return await this.client.createView(this.data.mapSlug, data);
	}

	async updateView(viewId: ID, data: View<CRU.UPDATE>): Promise<View> {
		return await this.client.updateView(this.data.mapSlug, viewId, data);
	}

	async deleteView(viewId: ID): Promise<void> {
		return await this.client.deleteView(this.data.mapSlug, viewId);
	}

}