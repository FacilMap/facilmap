import type { MapStorage, SocketClientStorage } from "facilmap-client";
import type { MapSlug } from "facilmap-types";

export enum ClientContextMapState {
	OPENING = "opening",
	OPEN = "open",
	CREATE = "create",
	DELETED = "deleted",
	ERROR = "error"
};

export type ClientContextMap = {
	mapSlug: MapSlug;
} & (
	| { state: ClientContextMapState.OPENING | ClientContextMapState.CREATE | ClientContextMapState.DELETED; get data(): MapStorage | undefined; error?: undefined }
	| { state: ClientContextMapState.OPEN; get data(): MapStorage; error?: undefined }
	| { state: ClientContextMapState.ERROR; get data(): MapStorage | undefined; error: Error }
);

export type ClientContext = SocketClientStorage & {
	map?: ClientContextMap;

	openMap(mapSlug: MapSlug | undefined): void;
};