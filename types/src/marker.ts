import { AllOptionalExceptId, Colour, ID, Point, Shape, Symbol } from "./base";

export interface Marker extends Point {
	id: ID;
	name: string;
	colour: Colour;
	size: number;
	symbol: Symbol;
	shape: Shape;
	elevation: number;
	typeId: ID;
	data: Record<string, string>;
}

export type MarkerCreate = Marker;
export type MarkerUpdate = AllOptionalExceptId<MarkerCreate>;
