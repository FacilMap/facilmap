import { Bbox, ID, Layer } from "./base";
import { PadId } from "./padData";

export interface View extends Bbox {
	id: ID;
	name: string;
	baseLayer: Layer;
	layers: Layer[];
	filter?: string;
	padId: PadId;
}

export type ViewCreate = Omit<View, "id" | "padId">;
export type ViewUpdate = Partial<ViewCreate>;
