import type Client from "facilmap-client";

export type ClientContext = Client & {
	/** If this is a true, it means that the current pad ID was not found and a create dialog is shown for it. */
	get isCreatePad(): boolean;
	openPad(padId: string | undefined): void;
};