import { AllOptionalExceptId, Bbox, ID, Layer, OmitId } from "./base";

export interface View extends Bbox {
	id: ID;
	name: string;
	baseLayer: Layer;
	layers: Layer[];
	filter?: string;
}

export type ViewCreate = OmitId<View>;
export type ViewUpdate = AllOptionalExceptId<View>;
