import { AllOptionalExceptId, Colour, ID, RouteMode, Shape } from "./base";

type ObjectType = "marker" | "line";
type FieldType = "textarea" | "dropdown" | "checkbox" | "input";
type FieldValue<F extends FieldType> = F extends "checkbox" ? boolean : string;
type OptionValue<F extends FieldType> = F extends "checkbox" ? "1" | "0" : string;

type FieldBase<F extends FieldType, O extends ObjectType, isUpdate extends boolean> = {
	name: string;
	type: F;
	controlColour: boolean;
	default: FieldValue<F>;
} & (O extends "marker" ? {
	controlSize: boolean;
	controlSymbol: boolean;
	controlShape: boolean;
} : {
	controlWidth: boolean;
}) & (F extends "dropdown" | "checkbox" ? {
	options: Array<FieldOption<F, O, isUpdate>>
} : { }) & (isUpdate extends true ? {
	oldName: string;
} : { });

type FieldOption<F extends FieldType, O extends ObjectType, isUpdate extends boolean> = {
	value: OptionValue<F>;
	colour?: Colour;
} & (O extends "marker" ? {
	size: number;
	symbol: Symbol;
	shape: Shape;
} : {
	width: number;
}) & (isUpdate extends true ? {
	oldValue?: OptionValue<F>
} : { });

type Field<O extends ObjectType, isUpdate extends boolean> =
	FieldBase<"textarea", O, isUpdate>
	| FieldBase<"dropdown", O, isUpdate>
	| FieldBase<"checkbox", O, isUpdate>
	| FieldBase<"input", O, isUpdate>;

type TypeBase<O extends ObjectType, isUpdate extends boolean> = {
	id: ID;
	name: string;
	defaultColour: Colour | null;
	fields: Array<Field<O, isUpdate>>
} & (isUpdate extends false ? {
	type: O
} : {}) & (O extends "marker" ? {
	defaultSize?: number;
	defaultSymbol?: Symbol;
	defaultShape?: Shape;
} : {
	defaultWidth: number;
	defaultMode: RouteMode;
});

export type Type = TypeBase<"marker", false> | TypeBase<"line", false>;
export type TypeCreate = Type;
export type TypeUpdate = AllOptionalExceptId<TypeBase<"marker", true> | TypeBase<"line", true>>;
