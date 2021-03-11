import { Colour, ID, RouteMode, Shape, Symbol } from "./base";
import { PadId } from "./padData";

type ObjectType = "marker" | "line";
type FieldType = "textarea" | "dropdown" | "checkbox" | "input";

type FieldBase<isUpdate extends boolean> = {
	name: string;
	type: FieldType;
	controlColour?: boolean;
	default?: string;
	controlSize?: boolean;
	controlSymbol?: boolean;
	controlShape?: boolean;
	controlWidth?: boolean;
	options?: Array<FieldOptionBase<isUpdate>>;
} & (isUpdate extends true ? {
	oldName?: string;
} : { });

type FieldOptionBase<isUpdate extends boolean> = {
	value: string;
	colour?: Colour;
	size?: number;
	symbol?: Symbol;
	shape?: Shape;
	width?: number;
} & (isUpdate extends true ? {
	oldValue?: string;
} : { });

export type Field = FieldBase<false>;
export type FieldUpdate = FieldBase<true>;
export type FieldOption = FieldOptionBase<false>;
export type FieldOptionUpdate = FieldOptionBase<true>;

type TypeBase<isUpdate extends boolean> = {
	id: ID;
	padId: PadId;
	name: string;
	defaultColour?: Colour | null;
	colourFixed?: boolean;
	fields: Array<FieldBase<isUpdate>>;
	defaultSize?: number | null;
	sizeFixed?: boolean;
	defaultSymbol?: Symbol | null;
	symbolFixed?: boolean;
	defaultShape?: Shape | null;
	shapeFixed?: boolean;
	defaultWidth?: number | null;
	widthFixed?: boolean;
	defaultMode?: RouteMode | null;
	modeFixed?: boolean;
	showInLegend?: boolean;
} & (isUpdate extends false ? {
	type: ObjectType;
} : {});

export type Type = TypeBase<false>;
export type TypeCreate = Omit<Type, "id" | "padId">;
export type TypeUpdate = Partial<Omit<TypeBase<true>, "id" | "padId">>;
