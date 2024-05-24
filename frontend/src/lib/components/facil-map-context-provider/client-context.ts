import type SocketClient from "facilmap-client";

export type ClientContext = SocketClient & {
	/** If this is a true, it means that the current map ID was not found and a create dialog is shown for it. */
	get isCreateMap(): boolean;
	openMap(mapId: string | undefined): void;
};