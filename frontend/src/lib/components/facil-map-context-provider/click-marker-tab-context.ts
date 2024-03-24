import type { Point } from "facilmap-types";

export interface WritableClickMarkerTabContext {
	openClickMarker(point: Point): Promise<void>;
	closeLastClickMarker(): void;
}

export type ClickMarkerTabContext = Readonly<WritableClickMarkerTabContext>;