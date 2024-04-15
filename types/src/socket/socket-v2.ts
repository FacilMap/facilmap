import { idValidator, type ReplaceProperties } from "../base.js";
import { markerValidator } from "../marker.js";
import { refineRawTypeValidator, rawTypeValidator, fieldOptionValidator, refineRawFieldOptionsValidator, fieldValidator, refineRawFieldsValidator } from "../type.js";
import type { MultipleEvents } from "../events.js";
import { renameProperty, type FindOnMapMarker, type FindOnMapResult, type RenameProperty, type ReplaceProperty } from "./socket-common.js";
import { requestDataValidatorsV3, type MapEventsV3, type ResponseDataMapV3 } from "./socket-v3.js";
import type { CRU, CRUType } from "../cru.js";
import * as z from "zod";

// Socket v2:
// - “icon” is called “symbol” in `Marker.symbol`, `Type.defaultSymbol`, `Type.symbolFixed`, `Type.fields[].controlSymbol` and
//   `Type.fields[].options[].symbol`.

export const legacyV2MarkerValidator = {
	read: markerValidator.read.omit({ icon: true }).extend({ symbol: markerValidator.read.shape.icon }),
	create: markerValidator.create.omit({ icon: true }).extend({ symbol: markerValidator.create.shape.icon }),
	update: markerValidator.update.omit({ icon: true }).extend({ symbol: markerValidator.update.shape.icon })
};
export type LegacyV2Marker<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof legacyV2MarkerValidator>;

export const legacyV2FieldOptionsValidator = refineRawFieldOptionsValidator({
	read: z.array(fieldOptionValidator.read.omit({ icon: true }).extend({ symbol: fieldOptionValidator.read.shape.icon })),
	create: z.array(fieldOptionValidator.create.omit({ icon: true }).extend({ symbol: fieldOptionValidator.create.shape.icon })),
	update: z.array(fieldOptionValidator.update.omit({ icon: true }).extend({ symbol: fieldOptionValidator.update.shape.icon }))
});

export const legacyV2FieldsValidator = refineRawFieldsValidator({
	read: z.array(fieldValidator.read.omit({ controlIcon: true, options: true }).extend({
		controlSymbol: fieldValidator.read.shape.controlIcon,
		options: legacyV2FieldOptionsValidator.read.optional()
	})),
	create: z.array(fieldValidator.create.omit({ controlIcon: true, options: true }).extend({
		controlSymbol: fieldValidator.create.shape.controlIcon,
		options: legacyV2FieldOptionsValidator.create.optional()
	})),
	update: z.array(fieldValidator.update.omit({ controlIcon: true, options: true }).extend({
		controlSymbol: fieldValidator.update.shape.controlIcon,
		options: legacyV2FieldOptionsValidator.update.optional()
	}))
});

export const legacyV2TypeValidator = refineRawTypeValidator({
	read: rawTypeValidator.read.omit({ defaultIcon: true, iconFixed: true, fields: true }).extend({
		defaultSymbol: rawTypeValidator.read.shape.defaultIcon,
		symbolFixed: rawTypeValidator.read.shape.iconFixed,
		fields: legacyV2FieldsValidator.read
	}),
	create: rawTypeValidator.create.omit({ defaultIcon: true, iconFixed: true }).extend({
		defaultSymbol: rawTypeValidator.create.shape.defaultIcon,
		symbolFixed: rawTypeValidator.create.shape.iconFixed,
		fields: legacyV2FieldsValidator.create
	}),
	update: rawTypeValidator.update.omit({ defaultIcon: true, iconFixed: true }).extend({
		defaultSymbol: rawTypeValidator.update.shape.defaultIcon,
		symbolFixed: rawTypeValidator.update.shape.iconFixed,
		fields: legacyV2FieldsValidator.update
	})
});
export type LegacyV2Type<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof legacyV2TypeValidator>;

export type LegacyV2FindOnMapMarker = RenameProperty<FindOnMapMarker, "icon", "symbol", false>;
export type LegacyV2FindOnMapResult = LegacyV2FindOnMapMarker | Exclude<FindOnMapResult, FindOnMapMarker>;

export const requestDataValidatorsV2 = {
	...requestDataValidatorsV3,
	addMarker: legacyV2MarkerValidator.create,
	editMarker: legacyV2MarkerValidator.update.extend({ id: idValidator }),
	addType: legacyV2TypeValidator.create,
	editType: legacyV2TypeValidator.update.extend({ id: idValidator })
};

export type ResponseDataMapV2 = ReplaceProperties<ResponseDataMapV3, {
	updateBbox: MultipleEvents<MapEventsV2>;
	createPad: MultipleEvents<MapEventsV2>;
	listenToHistory: MultipleEvents<MapEventsV2>;
	revertHistoryEntry: MultipleEvents<MapEventsV2>;
	getMarker: LegacyV2Marker;
	addMarker: LegacyV2Marker;
	editMarker: LegacyV2Marker;
	deleteMarker: LegacyV2Marker;
	findOnMap: Array<LegacyV2FindOnMapResult>;
	addType: LegacyV2Type;
	editType: LegacyV2Type;
	deleteType: LegacyV2Type;
	setPadId: MultipleEvents<MapEventsV2>;
}>;

export type MapEventsV2 = ReplaceProperties<MapEventsV3, {
	marker: [LegacyV2Marker];
	type: [LegacyV2Type];
}>;

export function legacyV2MarkerToCurrent<M extends Record<keyof any, any>, KeepOld extends boolean = false>(marker: M, keepOld?: KeepOld): RenameProperty<M, "symbol", "icon", KeepOld> {
	return renameProperty(marker, "symbol", "icon", keepOld);
}

export function currentMarkerToLegacyV2<M extends Record<keyof any, any>, KeepOld extends boolean = false>(marker: M, keepOld?: KeepOld): RenameProperty<M, "icon", "symbol", KeepOld> {
	return renameProperty(marker, "icon", "symbol", keepOld);
}

type RenameNestedArrayProperty<T, Key extends keyof any, From extends keyof any, To extends keyof any, KeepOld extends boolean = false> = (
	T extends Record<Key, Array<Record<From, any>>>
		? ReplaceProperty<T, Key, Array<RenameProperty<T[Key][number], From, To, KeepOld>>>
		: T
);
type RenameNestedNestedArrayProperty<T, Key1 extends keyof any, Key2 extends keyof any, From extends keyof any, To extends keyof any, KeepOld extends boolean = false> = (
	T extends Record<Key1, Array<Record<Key2, Array<Record<From, any>>>>>
		? ReplaceProperty<T, Key1, Array<ReplaceProperty<T[Key1][number], Key2, RenameProperty<T[Key1][number][Key2][number], From, To, KeepOld>>>>
		: T
);
type RenameTypeProperties<
	T,
	DefaultIconKeyOld extends keyof any,
	DefaultIconKeyNew extends keyof any,
	IconFixedKeyOld extends keyof any,
	IconFixedKeyNew extends keyof any,
	ControlIconKeyOld extends keyof any,
	ControlIconKeyNew extends keyof any,
	OptionIconKeyOld extends keyof any,
	OptionIconKeyNew extends keyof any,
	KeepOld extends boolean = false
> = RenameNestedNestedArrayProperty<
	RenameNestedArrayProperty<
		RenameProperty<
			RenameProperty<T, DefaultIconKeyOld, DefaultIconKeyNew, KeepOld>,
			IconFixedKeyOld, IconFixedKeyNew, KeepOld
		>, "fields", ControlIconKeyOld, ControlIconKeyNew, KeepOld
	>, "fields", "options", OptionIconKeyOld, OptionIconKeyNew, KeepOld
>;

export function legacyV2TypeToCurrent<T extends Record<keyof any, any>, KeepOld extends boolean = false>(type: T, keepOld?: KeepOld): RenameTypeProperties<T, "defaultSymbol", "defaultIcon", "symbolFixed", "iconFixed", "controlSymbol", "controlIcon", "symbol", "icon", KeepOld> {
	const renamedType = renameProperty(renameProperty(type, "defaultSymbol", "defaultIcon", keepOld), "symbolFixed", "iconFixed", keepOld) as any;

	if (renamedType.fields && Array.isArray(renamedType.fields)) {
		renamedType.fields = renamedType.fields.map((field: any) => {
			const renamedField = renameProperty(field, "controlSymbol", "controlIcon", keepOld);
			if (Array.isArray(renamedField?.options)) {
				renamedField.options = renamedField.options.map((option: any) => renameProperty(option, "symbol", "icon", keepOld));
			}
			return renamedField;
		});
	}

	return renamedType;
}

export function currentTypeToLegacyV2<T extends Record<keyof any, any>, KeepOld extends boolean = false>(type: T, keepOld?: KeepOld): RenameTypeProperties<T, "defaultIcon", "defaultSymbol", "iconFixed", "symbolFixed", "controlIcon", "controlSymbol", "icon", "symbol", KeepOld> {
	const renamedType = renameProperty(renameProperty(type, "defaultIcon", "defaultSymbol", keepOld), "iconFixed", "symbolFixed", keepOld) as any;

	if (renamedType.fields && Array.isArray(renamedType.fields)) {
		renamedType.fields = renamedType.fields.map((field: any) => {
			const renamedField = renameProperty(field, "controlIcon", "controlSymbol", keepOld);
			if (Array.isArray(renamedField?.options)) {
				renamedField.options = renamedField.options.map((option: any) => renameProperty(option, "icon", "symbol", keepOld));
			}
			return renamedField;
		});
	}

	return renamedType;
}