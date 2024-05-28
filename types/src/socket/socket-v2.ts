import { bboxWithZoomValidator, exportFormatValidator, idValidator, mapSlugValidator, objectWithIdValidator, type DistributiveKeyOf, type DistributiveOmit, type ID, type MapSlug, type ObjectWithId, type ReplaceProperties } from "../base.js";
import { markerValidator } from "../marker.js";
import { refineRawTypeValidator, rawTypeValidator, fieldOptionValidator, refineRawFieldOptionsValidator, fieldValidator, refineRawFieldsValidator, defaultFields } from "../type.js";
import type { EventName } from "../events.js";
import { nullOrUndefinedValidator, renameProperty, type RenameProperty, type ReplaceProperty } from "./socket-common.js";
import { socketV3RequestValidators, type SocketApiV3 } from "./socket-v3.js";
import type { CRU, CRUType } from "../cru.js";
import * as z from "zod";
import type { GenericHistoryEntry, HistoryEntry } from "../historyEntry.js";
import { omit, pick } from "lodash-es";
import { lineValidator, type LineTemplate, type TrackPoint } from "../line.js";
import { viewValidator } from "../view.js";
import { pagingValidator, type FindOnMapMarker, type FindOnMapResult, type PagedResults } from "../api/api-common.js";
import { mapDataValidator, type MapData, type MapDataWithWritable } from "../mapData.js";
import type { SearchResult } from "../searchResult.js";
import { routeParametersValidator, type Route } from "../route.js";

// Socket v2:
// - “icon” is called “symbol” in `Marker.symbol`, `Type.defaultSymbol`, `Type.symbolFixed`, `Type.fields[].controlSymbol` and
//   `Type.fields[].options[].symbol`.
// - “map” is called “pad” in events, types, methods
// - "MapNotFoundError" is called "PadNotFoundError"

export const legacyV2MapDataValidator = {
	read: mapDataValidator.read.omit({ readId: true, id: true }).extend({ id: mapDataValidator.read.shape.readId }),
	create: mapDataValidator.create.omit({ readId: true, id: true }).extend({ id: mapDataValidator.create.shape.readId }),
	update: mapDataValidator.update.omit({ readId: true, id: true }).extend({ id: mapDataValidator.update.shape.readId }),
};
export type LegacyV2MapData<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof legacyV2MapDataValidator>;
export type LegacyV2FindMapsResult = Pick<LegacyV2MapData, "id" | "name" | "description">;
export type LegacyV2MapDataWithWritable = DistributiveOmit<MapDataWithWritable, "readId" | "id"> & { id: MapData["readId"] };

export const legacyV2MarkerValidator = {
	read: markerValidator.read.omit({ icon: true, mapId: true }).extend({ symbol: markerValidator.read.shape.icon, padId: mapSlugValidator }),
	create: markerValidator.create.omit({ icon: true }).extend({ symbol: markerValidator.create.shape.icon }),
	update: markerValidator.update.omit({ icon: true }).extend({ symbol: markerValidator.update.shape.icon })
};
export type LegacyV2Marker<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof legacyV2MarkerValidator>;

export const legacyV2LineValidator = {
	read: lineValidator.read.omit({ mapId: true }).extend({ padId: mapSlugValidator }),
	create: lineValidator.create,
	update: lineValidator.update
};
export type LegacyV2Line<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof legacyV2LineValidator>;

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
	read: rawTypeValidator.read.omit({ defaultIcon: true, iconFixed: true, fields: true, mapId: true }).extend({
		defaultSymbol: rawTypeValidator.read.shape.defaultIcon,
		symbolFixed: rawTypeValidator.read.shape.iconFixed,
		fields: legacyV2FieldsValidator.read,
		padId: mapSlugValidator
	}),
	create: rawTypeValidator.create.omit({ defaultIcon: true, iconFixed: true }).extend({
		defaultSymbol: rawTypeValidator.create.shape.defaultIcon,
		symbolFixed: rawTypeValidator.create.shape.iconFixed,
		fields: legacyV2FieldsValidator.create.default(defaultFields)
	}),
	update: rawTypeValidator.update.omit({ defaultIcon: true, iconFixed: true }).extend({
		defaultSymbol: rawTypeValidator.update.shape.defaultIcon,
		symbolFixed: rawTypeValidator.update.shape.iconFixed,
		fields: legacyV2FieldsValidator.update
	})
});
export type LegacyV2Type<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof legacyV2TypeValidator>;

export const legacyV2ViewValidator = {
	read: viewValidator.read.omit({ mapId: true }).extend({ padId: mapSlugValidator }),
	create: viewValidator.create,
	update: viewValidator.update
};
export type LegacyV2View<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof legacyV2ViewValidator>;

export type LegacyV2FindOnMapMarker = RenameProperty<FindOnMapMarker, "icon", "symbol", false>;
export type LegacyV2FindOnMapResult = LegacyV2FindOnMapMarker | Exclude<FindOnMapResult, FindOnMapMarker>;

export type LegacyV2HistoryEntry = Omit<GenericHistoryEntry<{
	Map: Omit<LegacyV2MapData, "id" | "defaultView">;
	Marker: Omit<LegacyV2Marker, "id" | "padId">;
	Line: Omit<LegacyV2Line, "id" | "padId">;
	Type: Omit<LegacyV2Type, "id" | "padId">;
	View: Omit<LegacyV2View, "id" | "padId">;
}>, "mapId"> & {
	padId: MapSlug;
};

export const legacyV2FindMapsQueryValidator = pagingValidator.extend({
	query: z.string()
});

export const legacyV2GetMapQueryValidator = z.object({
	padId: mapSlugValidator
});

export const legacyV2LineTemplateRequestValidator = z.object({
	typeId: idValidator
});

export const legacyV2LineExportRequestValidator = z.object({
	id: idValidator,
	format: exportFormatValidator
});

export const legacyV2FindQueryValidator = z.object({
	query: z.string(),
	loadUrls: z.boolean().optional()
});

export const legacyV2FindOnMapQueryValidator = z.object({
	query: z.string()
});

export const legacyV2RouteCreateValidator = routeParametersValidator.extend({
	routeId: z.string().optional()
});

export const legacyV2LineToRouteCreateValidator = z.object({
	/** The ID of the line. */
	id: idValidator,
	routeId: z.string().optional()
});

export const legacyV2RouteExportRequestValidator = z.object({
	format: exportFormatValidator,
	routeId: z.string().optional()
});

export const legacyV2RouteClearValidator = z.object({
	routeId: z.string().optional()
});

export interface LegacyV2LinePointsEvent {
	id: ID;
	reset?: boolean;
	trackPoints: TrackPoint[];
}

export type MultipleEvents<Events extends Record<string, any[]>> = {
	[E in EventName<Events>]?: Array<Events[E][0]>;
};

export type LegacyV2Route = ReplaceProperties<Route, { routeId?: string }>;

export const socketV2RequestValidators = {
	...pick(socketV3RequestValidators, [
		"getRoute", "geoip", "setLanguage"
	]),
	getPad: z.tuple([legacyV2GetMapQueryValidator]),
	findPads: z.tuple([legacyV2FindMapsQueryValidator]),
	createPad: z.tuple([legacyV2MapDataValidator.create]),
	editPad: z.tuple([legacyV2MapDataValidator.update]),
	deletePad: z.tuple([nullOrUndefinedValidator]),
	findOnMap: z.tuple([legacyV2FindOnMapQueryValidator]),
	revertHistoryEntry: z.tuple([objectWithIdValidator]),
	getMarker: z.tuple([objectWithIdValidator]),
	addMarker: z.tuple([legacyV2MarkerValidator.create]),
	editMarker: z.tuple([legacyV2MarkerValidator.update.extend({ id: idValidator })]),
	deleteMarker: z.tuple([objectWithIdValidator]),
	getLineTemplate: z.tuple([legacyV2LineTemplateRequestValidator]),
	addLine: z.tuple([lineValidator.create]),
	editLine: z.tuple([lineValidator.update.extend({ id: idValidator })]),
	deleteLine: z.tuple([objectWithIdValidator]),
	exportLine: z.tuple([legacyV2LineExportRequestValidator]),
	addType: z.tuple([legacyV2TypeValidator.create]),
	editType: z.tuple([legacyV2TypeValidator.update.extend({ id: idValidator })]),
	deleteType: z.tuple([objectWithIdValidator]),
	addView: z.tuple([viewValidator.create]),
	editView: z.tuple([viewValidator.update.extend({ id: idValidator })]),
	deleteView: z.tuple([objectWithIdValidator]),
	find: z.tuple([legacyV2FindQueryValidator]),

	setPadId: z.tuple([z.string()]),
	updateBbox: z.tuple([bboxWithZoomValidator]),
	listenToHistory: z.tuple([nullOrUndefinedValidator]),
	stopListeningToHistory: z.tuple([nullOrUndefinedValidator]),

	setRoute: z.tuple([legacyV2RouteCreateValidator]),
	clearRoute: z.tuple([legacyV2RouteClearValidator.or(nullOrUndefinedValidator)]),
	lineToRoute: z.tuple([legacyV2LineToRouteCreateValidator]),
	exportRoute: z.tuple([legacyV2RouteExportRequestValidator]),
};

type SocketV2Response = {
	getPad: LegacyV2FindMapsResult | null;
	findPads: PagedResults<LegacyV2FindMapsResult>;
	createPad: MultipleEvents<MapEventsV2>;
	editPad: LegacyV2MapDataWithWritable;
	deletePad: null;
	findOnMap: Array<LegacyV2FindOnMapResult>;
	revertHistoryEntry: MultipleEvents<MapEventsV2>;
	getMarker: LegacyV2Marker;
	addMarker: LegacyV2Marker;
	editMarker: LegacyV2Marker;
	deleteMarker: LegacyV2Marker;
	getLineTemplate: LineTemplate;
	addLine: LegacyV2Line;
	editLine: LegacyV2Line;
	deleteLine: LegacyV2Line;
	exportLine: string;
	addType: LegacyV2Type;
	editType: LegacyV2Type;
	deleteType: LegacyV2Type;
	addView: LegacyV2View;
	editView: LegacyV2View;
	deleteView: LegacyV2View;
	find: SearchResult[] | string;

	setPadId: MultipleEvents<MapEventsV2>;
	updateBbox: MultipleEvents<MapEventsV2>;
	listenToHistory: MultipleEvents<MapEventsV2>;
	stopListeningToHistory: null;

	setRoute: LegacyV2Route | null;
	clearRoute: null;
	lineToRoute: LegacyV2Route | null;
	exportRoute: string;
};

export type SocketApiV2<Validated extends boolean = false> = Pick<SocketApiV3<Validated>, (
	| "getRoute" | "geoip" | "setLanguage"
)> & {
	[K in keyof SocketV2Response]: (...args: Validated extends true ? z.infer<typeof socketV2RequestValidators[K]> : z.input<typeof socketV2RequestValidators[K]>) => Promise<SocketV2Response[K]>;
};

export type MapEventsV2 = {
	marker: [LegacyV2Marker];
	deleteMarker: [ObjectWithId];
	line: [LegacyV2Line];
	deleteLine: [ObjectWithId];
	linePoints: [LegacyV2LinePointsEvent];
	type: [LegacyV2Type];
	deleteType: [ObjectWithId];
	view: [LegacyV2View];
	deleteView: [ObjectWithId];
	history: [LegacyV2HistoryEntry];
	padData: [LegacyV2MapDataWithWritable];
	deletePad: [];
	routePoints: [TrackPoint[]];
	routePointsWithId: [{ routeId: string; trackPoints: TrackPoint[] }];
};

type MapIdToLegacyV2<T extends Record<keyof any, any>, KeepOld> = "mapId" extends DistributiveKeyOf<T> ? DistributiveOmit<T, KeepOld extends true ? never : "mapId"> & { padId: MapSlug } : T;
function mapIdToLegacyV2<T extends Record<keyof any, any>, KeepOld extends boolean = false>(obj: T, readId: MapSlug, keepOld?: KeepOld): MapIdToLegacyV2<T, KeepOld> {
	if (obj.mapId) {
		return {
			...keepOld ? obj : omit(obj, ["mapId"]),
			padId: readId
		} as any;
	} else {
		return obj as any;
	}
}

export function legacyV2MapDataToCurrent<M extends Record<keyof any, any>>(mapData: M): RenameProperty<M, "id", "readId"> {
	return renameProperty(mapData, "id", "readId");
}

export function currentMapDataToLegacyV2<M extends Record<keyof any, any>>(mapData: M): RenameProperty<M extends { id: any } ? Omit<M, "id"> : M, "readId", "id"> {
	return renameProperty(omit(mapData, ["id"]), "readId", "id") as any;
}

export function legacyV2MarkerToCurrent<M extends Record<keyof any, any>, KeepOld extends boolean = false>(marker: M, keepOld?: KeepOld): RenameProperty<M, "symbol", "icon", KeepOld> {
	return renameProperty(marker, "symbol", "icon", keepOld);
}

export function currentMarkerToLegacyV2<M extends Record<keyof any, any>, KeepOld extends boolean = false>(marker: M, readId: MapSlug, keepOld?: KeepOld): MapIdToLegacyV2<RenameProperty<M, "icon", "symbol", KeepOld>, KeepOld> {
	return mapIdToLegacyV2(renameProperty(marker, "icon", "symbol", keepOld), readId, keepOld);
}

export function currentLineToLegacyV2<L extends Record<keyof any, any>, KeepOld extends boolean = false>(line: L, readId: MapSlug, keepOld?: KeepOld): MapIdToLegacyV2<L, KeepOld> {
	return mapIdToLegacyV2(line, readId, keepOld);
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

export function currentTypeToLegacyV2<T extends Record<keyof any, any>, KeepOld extends boolean = false>(type: T, readId: MapSlug, keepOld?: KeepOld): MapIdToLegacyV2<RenameTypeProperties<T, "defaultIcon", "defaultSymbol", "iconFixed", "symbolFixed", "controlIcon", "controlSymbol", "icon", "symbol", KeepOld>, KeepOld> {
	const renamedType = mapIdToLegacyV2(renameProperty(renameProperty(type, "defaultIcon", "defaultSymbol", keepOld), "iconFixed", "symbolFixed", keepOld), readId, keepOld) as any;

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

export function currentViewToLegacyV2<V extends Record<keyof any, any>, KeepOld extends boolean = false>(view: V, readId: MapSlug, keepOld?: KeepOld): MapIdToLegacyV2<V, KeepOld> {
	return mapIdToLegacyV2(view, readId, keepOld);
}

type ReplacePropertyIfNotUndefined<T extends Record<keyof any, any>, Key extends keyof any, Value> = T[Key] extends undefined ? T : ReplaceProperty<T, Key, Value>;
function mapHistoryEntry<Obj extends { objectBefore?: any; objectAfter?: any }, Out>(entry: Obj, mapper: (obj: (Obj extends { objectBefore: {} } ? Obj["objectBefore"] : never) | (Obj extends { objectAfter: {} } ? Obj["objectAfter"] : never)) => Out): ReplacePropertyIfNotUndefined<ReplacePropertyIfNotUndefined<Obj, "objectBefore", Out>, "objectAfter", Out> {
	return {
		...entry,
		..."objectBefore" in entry && entry.objectBefore !== undefined ? { objectBefore: mapper(entry.objectBefore) } : {},
		..."objectAfter" in entry && entry.objectAfter !== undefined ? { objectAfter: mapper(entry.objectAfter) } : {}
	} as any;
}

export function currentHistoryEntryToLegacyV2(historyEntry: HistoryEntry, readId: MapSlug): LegacyV2HistoryEntry {
	let renamed = mapIdToLegacyV2(historyEntry, readId);

	if (renamed.type === "Map") {
		return mapHistoryEntry(renamed, (obj) => obj && currentMapDataToLegacyV2(obj));
		} else if (renamed.type === "Marker") {
		return mapHistoryEntry(renamed, (obj) => obj && currentMarkerToLegacyV2(obj, readId));
	} else if (renamed.type === "Line") {
		return mapHistoryEntry(renamed, (obj) => obj && currentLineToLegacyV2(obj, readId));
	} else if (renamed.type === "Type") {
		return mapHistoryEntry(renamed, (obj) => obj && currentTypeToLegacyV2(obj, readId));
	} else if (renamed.type === "View") {
		return mapHistoryEntry(renamed, (obj) => obj && currentViewToLegacyV2(obj, readId));
	} else {
		return mapHistoryEntry(renamed, (obj) => obj);
	}
}