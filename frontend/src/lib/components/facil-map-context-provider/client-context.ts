import type Client from "facilmap-client";

export type ClientContext = Client & {
	openPad(padId: string | undefined): void;
};