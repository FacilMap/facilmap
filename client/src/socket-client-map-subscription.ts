import type { AllMapObjectsItem, AllMapObjectsPick, Bbox, BboxWithExcept, BboxWithZoom, CRU, DeepReadonly, EventHandler, EventName, ExportFormat, FindOnMapResult, HistoryEntry, ID, Line, LineTemplate, LineWithTrackPoints, MapData, MapDataWithWritable, MapSlug, Marker, PagedResults, PagingInput, SocketApi, SocketVersion, StreamedResults, SubscribeToMapOptions, TrackPoint, Type, View } from "facilmap-types";
import { type ClientEvents, type SocketClient } from "./socket-client";
import { type ReactiveObjectProvider } from "./reactivity";
import { mergeEventHandlers } from "./utils";
import { SocketClientSubscription, type SubscriptionState } from "./socket-client-subscription";

type SocketClientMapSubscriptionInterface = {
	[K in (
		| "getMap" | "updateMap" | "deleteMap" | "getAllMapObjects" | "findOnMap" | "getHistory"
		| "revertHistoryEntry" | "getMapMarkers" | "getMarker" | "createMarker" | "updateMarker" | "deleteMarker"
		| "getMapLines" | "getLine" | "getLinePoints" | "getLineTemplate" | "createLine" | "updateLine" | "deleteLine"
		| "exportLine" | "getMapTypes" | "getType" | "createType" | "updateType" | "deleteType" | "getMapViews"
		| "getView" | "createView" | "updateView" | "deleteView"
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
			options: mapOptions
		});
	}

	protected override async _doSubscribe(): Promise<void> {
		await this.client._subscribeToMap(this.mapSlug, this.data.options);
	}

	async updateSubscription(options: DeepReadonly<SubscribeToMapOptions>): Promise<void> {
		this.reactiveObjectProvider.set(this.data, "options", options);
		await this._doSubscribe();
	}

	protected override async _doUnsubscribe(): Promise<void> {
		await this.client._unsubscribeFromMap(this.mapSlug);
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

			deleteMap: (mapSlug) => {
				if (mapSlug === this.data.mapSlug) {
					this.reactiveObjectProvider.set(this.data, "state", { type: MapSubscriptionStateType.DELETED });
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

	async getAllMapObjects<Pick extends AllMapObjectsPick>(options?: { pick?: Pick[]; bbox?: BboxWithExcept }): Promise<AsyncIterable<AllMapObjectsItem<Pick>, void, undefined>> {
		return await this.client.getAllMapObjects(this.data.mapSlug, options);
	}

	async findOnMap(query: string): Promise<FindOnMapResult[]> {
		return await this.client.findOnMap(this.data.mapSlug, query);
	}

	async getHistory(data?: PagingInput): Promise<PagedResults<HistoryEntry>> {
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

	async getLineTemplate(options: { typeId: ID }): Promise<LineTemplate> {
		return await this.client.getLineTemplate(this.data.mapSlug, options);
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

	async exportLine(lineId: ID, options: { format: ExportFormat }): Promise<{ type: string; filename: string; data: ReadableStream<Uint8Array> }> {
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

export class SocketClientCreateMapSubscription extends SocketClientMapSubscription {
	protected readonly createMapData: DeepReadonly<MapData<CRU.CREATE>>;

	constructor(client: SocketClient, data: MapData<CRU.CREATE>, options?: SubscribeToMapOptions & {
		reactiveObjectProvider?: ReactiveObjectProvider;
	}) {
		super(client, data.adminId, options);

		this.createMapData = data;
	}

	protected override async _doSubscribe(): Promise<void> {
		await this.client._createMapAndSubscribe(this.createMapData, this.data.options);
	}
}