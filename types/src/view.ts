import { AllOptionalExceptId, Bbox, ID, Layer } from "./base";

export interface View extends Bbox {
	id: ID;
	name: string;
	baseLayer: Layer;
	layers: Layer[];
	filter?: string;
}

export type ViewCreate = View;
export type ViewUpdate = AllOptionalExceptId<View>;
