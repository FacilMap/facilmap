import type { MapStorage, SocketClient, SocketClientStorage } from "facilmap-client";
import type { SocketClientMapSubscription } from "facilmap-client/src/socket-client-map-subscription";
import type { CRU, MapData, MapSlug } from "facilmap-types";

export enum ClientContextMapState {
	OPENING = "opening",
	OPEN = "open",
	CREATE = "create",
	DELETED = "deleted",
	ERROR = "error"
};

export type ClientContextMap = {
	mapSlug: MapSlug;
	subscription: SocketClientMapSubscription;
} & (
	| { state: ClientContextMapState.OPENING | ClientContextMapState.CREATE | ClientContextMapState.DELETED; get data(): MapStorage | undefined; error?: undefined }
	| { state: ClientContextMapState.OPEN; get data(): MapStorage & { mapData: NonNullable<MapStorage["mapData"]> }; error?: undefined }
	| { state: ClientContextMapState.ERROR; get data(): MapStorage | undefined; error: Error }
);

export type ClientContext = {
	client: SocketClient;
	storage: SocketClientStorage;
	/** Contains information about the currently subscribed map. */
	map?: ClientContextMap;
	openMap(mapSlug: MapSlug | undefined): void;
	createAndOpenMap(data: MapData<CRU.CREATE>): Promise<void>;
};