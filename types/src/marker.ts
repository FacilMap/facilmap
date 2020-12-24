import { Colour, ID, Point, Shape, Symbol } from "./base";
import { PadId } from "./padData";

export interface Marker extends Point {
	id: ID;
	name: string;
	colour: Colour;
	size: number;
	symbol: Symbol;
	shape: Shape;
	ele?: number;
	typeId: ID;
	data: Record<string, string>;
	padId: PadId;
}

export type MarkerCreate = Omit<Marker, "id" | "padId">;
export type MarkerUpdate = Partial<MarkerCreate>;
