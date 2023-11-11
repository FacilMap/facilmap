import type { Point } from "facilmap-types";

export interface WritableClickMarkerTabContext {
	openClickMarker(point: Point): Promise<void>;
}

export type ClickMarkerTabContext = Readonly<WritableClickMarkerTabContext>;