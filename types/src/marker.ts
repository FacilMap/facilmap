import { Colour, ID, Point, Shape, Symbol } from "./base.js";
import { PadId } from "./padData.js";

export interface Marker<DataType = Record<string, string>> extends Point {
	id: ID;
	name: string;
	colour: Colour;
	size: number;
	symbol: Symbol;
	shape: Shape;
	ele?: number;
	typeId: ID;
	data: DataType;
	padId: PadId;
}

export type MarkerCreate<DataType = Record<string, string>> = Partial<Omit<Marker<DataType>, "id" | "padId">> & Pick<Marker<DataType>, keyof Point | 'typeId'>;
export type MarkerUpdate<DataType = Record<string, string>> = Partial<MarkerCreate<DataType>>;