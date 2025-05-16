import { getMainAdminLink, type AllMapObjectsItem, type AllMapObjectsPick, type AnyMapSlug, type Bbox, type BboxWithExcept, type BboxWithZoom, type CRU, type DeepReadonly, type EventHandler, type EventName, type ExportResult, type FindOnMapResult, type HistoryEntry, type ID, type Line, type LineTemplate, type LineWithTrackPoints, type MapData, type MapPermissions, type MapSlug, type Marker, type PagedResults, type PagingInput, type SocketApi, type SocketVersion, type StreamedResults, type Stripped, type SubscribeToMapOptions, type TrackPoint, type Type, type View } from "facilmap-types";
import { type ClientEvents, type SocketClient } from "./socket-client";
import { type ReactiveObjectProvider } from "./reactivity";
import { mergeEventHandlers } from "./utils";
import { SocketClientSubscription, type SubscriptionState } from "./socket-client-subscription";

type SocketClientMapSubscriptionInterface = Omit<{
	[K in keyof SocketApi<SocketVersion.V3, false> as AnyMapSlug extends Parameters<SocketApi<SocketVersion.V3, false>[K]>[0] ? K : never]: (
		SocketApi<SocketVersion.V3, false>[K] extends (mapSlug: MapSlug, ...args: infer Args) => infer Result ? (...args: Args) => Result : never
	)
}, "subscribeToMap">;

declare const write: unique symbol;
declare global {
	interface WritableStreamDefaultWriter<W = any> {
		[write]?: (a: W) => void;
	}
}

export enum MapSubscriptionStateType {
	/** The map has been deleted. */
	DELETED = "deleted",
	/** The server has canceled the subscription because the map link was deleted or its slug/password modified. */
	CANCELED = "canceled"
};

export type MapSubscriptionState = SubscriptionState
	| { type: MapSubscriptionStateType.DELETED }
	| { type: MapSubscriptionStateType.CANCELED; error: Error & { status?: number } };

export interface MapSubscriptionData {
	state: DeepReadonly<MapSubscriptionState>;
	mapSlug: MapSlug;
	anyMapSlug: AnyMapSlug;
	options: DeepReadonly<SubscribeToMapOptions>;
};

export interface SocketClientMapSubscription extends Readonly<MapSubscriptionData> {
	// Getters are defined in SocketClientSubscription
}

export class SocketClientMapSubscription extends SocketClientSubscription<MapSubscriptionData> implements SocketClientMapSubscriptionInterface {
	protected upcomingPasswordChanges: Array<{ mapLinkId: ID; password: string | false }> = [];

	constructor(client: SocketClient, mapSlug: AnyMapSlug, options?: SubscribeToMapOptions & {
		reactiveObjectProvider?: ReactiveObjectProvider;
	}) {
		const { reactiveObjectProvider, ...mapOptions } = options ?? {};

		super(client, {
			reactiveObjectProvider,
			mapSlug: typeof mapSlug === "string" ? mapSlug : mapSlug.mapSlug,
			anyMapSlug: mapSlug,
			options: mapOptions
		});
	}

	protected override async _doSubscribe(): Promise<void> {
		await this.client._subscribeToMap(this.anyMapSlug, this.data.options);
	}

	async updateSubscription(options: DeepReadonly<Partial<SubscribeToMapOptions>>): Promise<void> {
		console.trace("updateSubscription", options);
		this.reactiveObjectProvider.set(this.data, "options", { ...this.data.options, ...options });
		await this._doSubscribe();
	}

	protected override async _doUnsubscribe(): Promise<void> {
		await this.client._unsubscribeFromMap(this.mapSlug);
	}

	protected _getEventHandlers(): {
		[E in EventName<ClientEvents>]?: EventHandler<ClientEvents, E>
	} {
		return mergeEventHandlers<ClientEvents>(super._getEventHandlers(), {
			mapData: (mapSlug, mapData) => {
				if (mapSlug === this.data.mapSlug && mapData.activeLink && mapData.activeLink.slug !== this.data.mapSlug) {
					const passwordChange = mapData.activeLink.id != null ? this.upcomingPasswordChanges.find((c) => c.mapLinkId === mapData.activeLink.id) : undefined;
					this.reactiveObjectProvider.set(this.data, "mapSlug", mapData.activeLink.slug);
					if (passwordChange) {
						this.reactiveObjectProvider.set(this.data, "anyMapSlug", (
							passwordChange.password === false ? mapData.activeLink.slug :
							{ mapSlug: mapData.activeLink.slug, password: passwordChange.password }
						));
					} else {
						this.reactiveObjectProvider.set(this.data, "anyMapSlug", (
							typeof this.anyMapSlug === "string" ? mapData.activeLink.slug :
							{ ...this.anyMapSlug, mapSlug: mapData.activeLink.slug }
						));
					}
				}
			},

			deleteMap: (mapSlug) => {
				if (mapSlug === this.data.mapSlug) {
					this.reactiveObjectProvider.set(this.data, "state", { type: MapSubscriptionStateType.DELETED });
				}
			},

			cancelMapSubscription: (mapSlug, error) => {
				if (mapSlug === this.data.mapSlug) {
					this.reactiveObjectProvider.set(this.data, "state", { type: MapSubscriptionStateType.CANCELED, error });
				}
			},

			emit: (...args) => {
				if (args[0] === "updateMap") {
					const updates = args[1].args[1].links?.flatMap((l) => "id" in l && l.password != null && l.password !== true ? [{ mapLinkId: l.id, password: l.password }] : []) ?? [];
					this.upcomingPasswordChanges.push(...updates);
					void args[1].result.finally(() => {
						for (let i = 0; i < this.upcomingPasswordChanges.length; i++) {
							if (updates.includes(this.upcomingPasswordChanges[i])) {
								this.upcomingPasswordChanges.splice(i--, 1);
							}
						}
					});
				}
			}
		});
	};

	async getMap(): Promise<Stripped<MapData>> {
		return await this.client.getMap(this.data.mapSlug);
	}

	async updateMap(data: MapData<CRU.UPDATE>): Promise<Stripped<MapData>> {
		return await this.client.updateMap(this.data.mapSlug, data);
	}

	async deleteMap(): Promise<void> {
		await this.client.deleteMap(this.data.mapSlug);
	}

	async getAllMapObjects<Pick extends AllMapObjectsPick>(options?: { pick?: Pick[]; bbox?: BboxWithExcept }): Promise<AsyncIterable<AllMapObjectsItem<Pick>, void, undefined>> {
		return await this.client.getAllMapObjects(this.data.mapSlug, options);
	}

	async findOnMap(query: string): Promise<Array<Stripped<FindOnMapResult>>> {
		return await this.client.findOnMap(this.data.mapSlug, query);
	}

	async getMapToken(options: { permissions: MapPermissions; noPassword?: boolean }): Promise<{ token: string }> {
		return await this.client.getMapToken(this.data.mapSlug, options);
	}

	async exportMapAsGpx(options?: { rte?: boolean; filter?: string }): Promise<ExportResult> {
		return await this.client.exportMapAsGpx(this.data.mapSlug, options);
	}

	async exportMapAsGpxZip(options?: { rte?: boolean; filter?: string }): Promise<ExportResult> {
		return await this.client.exportMapAsGpxZip(this.data.mapSlug, options);
	}

	async exportMapAsGeoJson(options?: { filter?: string }): Promise<ExportResult> {
		return await this.client.exportMapAsGeoJson(this.data.mapSlug, options);
	}

	async exportMapAsTable(options: { typeId: ID; filter?: string; hide?: string[] }): Promise<ExportResult> {
		return await this.client.exportMapAsTable(this.data.mapSlug, options);
	}

	async exportMapAsCsv(options: { typeId: ID; filter?: string; hide?: string[] }): Promise<ExportResult> {
		return await this.client.exportMapAsCsv(this.data.mapSlug, options);
	}

	async getHistory(data?: PagingInput): Promise<PagedResults<Stripped<HistoryEntry>>> {
		return await this.client.getHistory(this.data.mapSlug, data);
	}

	async revertHistoryEntry(historyEntryId: ID): Promise<void> {
		await this.client.revertHistoryEntry(this.data.mapSlug, historyEntryId);
	}

	async getMapMarkers(options?: { bbox?: BboxWithExcept; typeId?: ID }): Promise<StreamedResults<Stripped<Marker>>> {
		return await this.client.getMapMarkers(this.data.mapSlug, options);
	}

	async getMarker(markerId: ID): Promise<Stripped<Marker>> {
		return await this.client.getMarker(this.data.mapSlug, markerId);
	}

	async createMarker(data: Marker<CRU.CREATE>): Promise<Stripped<Marker>> {
		return await this.client.createMarker(this.data.mapSlug, data);
	}

	async updateMarker(markerId: ID, data: Marker<CRU.UPDATE>): Promise<Stripped<Marker>> {
		return await this.client.updateMarker(this.data.mapSlug, markerId, data);
	}

	async deleteMarker(markerId: ID): Promise<void> {
		await this.client.deleteMarker(this.data.mapSlug, markerId);
	}

	async getMapLines<IncludeTrackPoints extends boolean = false>(options?: { bbox?: BboxWithZoom; includeTrackPoints?: IncludeTrackPoints; typeId?: ID }): Promise<StreamedResults<IncludeTrackPoints extends true ? Stripped<LineWithTrackPoints> : Stripped<Line>>> {
		return await this.client.getMapLines(this.data.mapSlug, options);
	}

	async getLine(lineId: ID): Promise<Stripped<Line>> {
		return await this.client.getLine(this.data.mapSlug, lineId);
	}

	async getLinePoints(lineId: ID, options?: { bbox?: BboxWithZoom & { except?: Bbox } }): Promise<StreamedResults<TrackPoint>> {
		return await this.client.getLinePoints(this.data.mapSlug, lineId, options);
	}

	async getLineTemplate(options: { typeId: ID }): Promise<LineTemplate> {
		return await this.client.getLineTemplate(this.data.mapSlug, options);
	}

	async createLine(data: Line<CRU.CREATE>): Promise<Stripped<Line>> {
		return await this.client.createLine(this.data.mapSlug, data);
	}

	async updateLine(lineId: ID, data: Line<CRU.UPDATE>): Promise<Stripped<Line>> {
		return await this.client.updateLine(this.data.mapSlug, lineId, data);
	}

	async deleteLine(lineId: ID): Promise<void> {
		await this.client.deleteLine(this.data.mapSlug, lineId);
	}

	async exportLineAsGpx(lineId: ID, options?: { rte?: boolean }): Promise<ExportResult> {
		return await this.client.exportLineAsGpx(this.data.mapSlug, lineId, options);
	}

	async exportLineAsGeoJson(lineId: ID): Promise<ExportResult> {
		return await this.client.exportLineAsGeoJson(this.data.mapSlug, lineId);
	}

	async getMapTypes(): Promise<StreamedResults<Stripped<Type>>> {
		return await this.client.getMapTypes(this.data.mapSlug);
	}

	async getType(typeId: ID): Promise<Stripped<Type>> {
		return await this.client.getType(this.data.mapSlug, typeId);
	}

	async createType(data: Type<CRU.CREATE>): Promise<Stripped<Type>> {
		return await this.client.createType(this.data.mapSlug, data);
	}

	async updateType(typeId: ID, data: Type<CRU.UPDATE>): Promise<Stripped<Type>> {
		return await this.client.updateType(this.data.mapSlug, typeId, data);
	}

	async deleteType(typeId: ID): Promise<void> {
		await this.client.deleteType(this.data.mapSlug, typeId);
	}

	async getMapViews(): Promise<StreamedResults<Stripped<View>>> {
		return await this.client.getMapViews(this.data.mapSlug);
	}

	async getView(viewId: ID): Promise<Stripped<View>> {
		return await this.client.getView(this.data.mapSlug, viewId);
	}

	async createView(data: View<CRU.CREATE>): Promise<Stripped<View>> {
		return await this.client.createView(this.data.mapSlug, data);
	}

	async updateView(viewId: ID, data: View<CRU.UPDATE>): Promise<Stripped<View>> {
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
		const mainAdminLink = getMainAdminLink(data.links);
		const anyMapSlug = mainAdminLink.password !== false ? { mapSlug: mainAdminLink.slug, password: mainAdminLink.password } : mainAdminLink.slug;
		super(client, anyMapSlug, options);

		this.createMapData = data;
	}

	protected override async _doSubscribe(): Promise<void> {
		await this.client._createMapAndSubscribe(this.createMapData, this.data.options);
	}
}