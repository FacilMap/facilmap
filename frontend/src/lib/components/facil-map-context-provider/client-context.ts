import type { SocketClientStorage } from "facilmap-client";
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
	| { state: Exclude<ClientContextMapState, ClientContextMapState.ERROR> }
	| { state: ClientContextMapState.ERROR; error: Error }
);

export type ClientContext = SocketClientStorage & {
	map?: ClientContextMap;

	openMap(mapSlug: MapSlug | undefined): void;
};