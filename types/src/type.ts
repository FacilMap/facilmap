import { AllOptionalExceptId, Colour, ID, OmitId, RouteMode, Shape, Symbol } from "./base";

type ObjectType = "marker" | "line";
type FieldType = "textarea" | "dropdown" | "checkbox" | "input";
type FieldValue<F extends FieldType> = string;
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

type FieldBaseAny<O extends ObjectType, isUpdate extends boolean> =
	FieldBase<"textarea", O, isUpdate>
	| FieldBase<"dropdown", O, isUpdate>
	| FieldBase<"checkbox", O, isUpdate>
	| FieldBase<"input", O, isUpdate>;

export type Field = FieldBaseAny<ObjectType, false>;
export type MarkerField = FieldBaseAny<"marker", false>;
export type LineField = FieldBaseAny<"line", false>;
type FieldWithOptions = FieldBase<"dropdown", ObjectType, false> | FieldBase<"checkbox", ObjectType, false>;
export type FieldOptions = Array<FieldOption<"dropdown" | "checkbox", ObjectType, false>>;

export function fieldHasOptions(field: Field): field is FieldWithOptions {
	return [ "dropdown", "checkbox" ].indexOf(field.type) != -1;
}

type TypeBase<O extends ObjectType, isUpdate extends boolean> = {
	id: ID;
	name: string;
	defaultColour: Colour | null;
	colourFixed: boolean;
	fields: Array<FieldBaseAny<O, isUpdate>>
} & (isUpdate extends false ? {
	type: O
} : {}) & (O extends "marker" ? {
	defaultSize: number | null;
	sizeFixed: boolean;
	defaultSymbol: Symbol | null;
	symbolFixed: boolean;
	defaultShape: Shape | null;
	shapeFixed: boolean;
} : {
	defaultWidth: number | null;
	widthFixed: boolean;
	defaultMode: RouteMode | null;
	modeFixed: boolean;
});

export type MarkerType = TypeBase<"marker", false>;
export type LineType = TypeBase<"line", false>;
export type Type = MarkerType | LineType;
export type TypeCreate = OmitId<Type>;
export type TypeUpdate = AllOptionalExceptId<TypeBase<"marker", true> | TypeBase<"line", true>>;
