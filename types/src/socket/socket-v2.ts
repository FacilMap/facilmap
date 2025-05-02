import { bboxWithZoomValidator, idValidator, mapSlugValidator, objectWithIdValidator, pointValidator, routeModeValidator, type ID, type MapSlug, type ObjectWithId } from "../base.js";
import { markerValidator } from "../marker.js";
import { refineRawTypeValidator, rawTypeValidator, fieldOptionValidator, refineRawFieldOptionsValidator, fieldValidator, refineRawFieldsValidator, defaultFields, type Type, dataByFieldIdToDataByName, dataByNameToDataByFieldId } from "../type.js";
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
import { ADMIN_LINK_COMMENT, getMainAdminLink, mapDataValidator, READ_LINK_COMMENT, WRITE_LINK_COMMENT, type ActiveMapLink, type MapLink } from "../mapData.js";
import type { SearchResult } from "../searchResult.js";
import { routeParametersValidator, type Route, type RouteInfo, type RouteRequest } from "../route.js";
import type { DistributiveKeyOf, DistributiveOmit, ReplaceExistingProperties } from "../utility.js";

// Socket v2:
// - “icon” is called “symbol” in `Marker.symbol`, `Type.defaultSymbol`, `Type.symbolFixed`, `Type.fields[].controlSymbol` and
//   `Type.fields[].options[].symbol`.
// - “map” is called “pad” in events, types, methods
// - "MapNotFoundError" is called "PadNotFoundError"

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
		fields: legacyV2FieldsValidator.update.optional()
	})
});
export type LegacyV2Type<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof legacyV2TypeValidator>;

export const legacyV2ViewValidator = {
	read: viewValidator.read.omit({ mapId: true }).extend({ padId: mapSlugValidator }),
	create: viewValidator.create,
	update: viewValidator.update
};
export type LegacyV2View<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof legacyV2ViewValidator>;

export const legacyV2MapDataValidator = {
	read: mapDataValidator.read.omit({ links: true, activeLink: true, id: true, defaultView: true }).extend({
		id: mapSlugValidator,
		writeId: mapSlugValidator,
		adminId: mapSlugValidator,
		searchEngines: z.boolean(),
		defaultView: legacyV2ViewValidator.read.or(z.null())
	}),
	create: mapDataValidator.create.omit({ links: true }).extend({
		id: mapSlugValidator,
		writeId: mapSlugValidator,
		adminId: mapSlugValidator,
		searchEngines: z.boolean().default(false)
	}),
	update: mapDataValidator.update.omit({ links: true }).extend({
		id: mapSlugValidator,
		writeId: mapSlugValidator,
		adminId: mapSlugValidator,
		searchEngines: z.boolean().optional()
	}),
};
export enum LegacyV2Writable { READ = 0, WRITE = 1, ADMIN = 2 };
export type LegacyV2MapData<Mode extends CRU = CRU.READ> = CRUType<Mode, typeof legacyV2MapDataValidator>;
export type LegacyV2FindMapsResult = Pick<LegacyV2MapData, "id" | "name" | "description">;
export type LegacyV2MapDataWithWritable = (
	| ({ writable: LegacyV2Writable.ADMIN } & LegacyV2MapData)
	| ({ writable: LegacyV2Writable.WRITE } & Omit<LegacyV2MapData, "adminId"> )
	| ({ writable: LegacyV2Writable.READ } & Omit<LegacyV2MapData, "adminId" | "writeId"> )
);

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
	format: z.enum(["gpx-trk", "gpx-rte"])
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
	format: z.enum(["gpx-trk", "gpx-rte"]),
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

export type LegacyV2Route = Route & { routeId?: string };

export const legacyV2RouteRequestValidator = z.object({
	destinations: z.array(pointValidator),
	mode: routeModeValidator
});

export const socketV2RequestValidators = {
	...pick(socketV3RequestValidators, [
		"geoip", "setLanguage"
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
	getRoute: z.tuple([legacyV2RouteRequestValidator]),

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
	getRoute: RouteInfo;

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
	| "geoip" | "setLanguage"
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

export function legacyV2MapDataToCurrent<M extends Record<keyof any, any>>(mapData: M): (
	Omit<M, "id" | "writeId" | "adminId" | "searchEngines"> &
	(Extract<keyof M, "readId" | "writeId" | "adminId"> extends "readId" | "writeId" | "adminId" ? { links: Array<MapLink<CRU.CREATE>> } : {})
);
export function legacyV2MapDataToCurrent<M extends Record<keyof any, any>>(mapData: M, currentMapLinks: MapLink[]): (
	Omit<M, "id" | "writeId" | "adminId" | "searchEngines"> &
	(Extract<keyof M, "readId" | "writeId" | "adminId"> extends "readId" | "writeId" | "adminId" ? { links: Array<MapLink<CRU.UPDATE>> } : {})
);
export function legacyV2MapDataToCurrent<M extends Record<keyof any, any>>(mapData: M, currentMapLinks?: MapLink[]): (
	Omit<M, "id" | "writeId" | "adminId" | "searchEngines"> &
	(Extract<keyof M, "readId" | "writeId" | "adminId"> extends "readId" | "writeId" | "adminId" ? { links: Array<MapLink<CRU.CREATE | CRU.UPDATE>> } : {})
) {
	let links: Array<MapLink<CRU.CREATE | CRU.UPDATE>>;
	if (currentMapLinks) {
		links = currentMapLinks.map((l) => ({ ...l }));
		const readLink = links.find((l) => !l.permissions.admin && !l.permissions.settings && !l.permissions.update && Object.keys(l.permissions.types ?? {}).length === 0);
		const writeLink = links.find((l) => !l.permissions.admin && !l.permissions.settings && l.permissions.update && Object.keys(l.permissions.types ?? {}).length === 0);
		const adminLink = links.find((l) => l.permissions.admin && Object.keys(l.permissions.types ?? {}).length === 0);
		if (links.length !== 3 || !readLink || !writeLink || !adminLink) {
			throw new Error("The map link configuration of this map is not compatible with API v1/v2.");
		}
		readLink.slug = mapData.id;
		writeLink.slug = mapData.writeId;
		adminLink.slug = mapData.adminId;
		if (mapData.searchEngines != null) {
			readLink.searchEngines = mapData.searchEngines;
		}
	} else {
		links = [
			{ slug: mapData.adminId, comment: ADMIN_LINK_COMMENT, password: false, permissions: { admin: true, settings: true, update: true, read: true }, searchEngines: false },
			{ slug: mapData.writeId, comment: WRITE_LINK_COMMENT, password: false, permissions: { admin: false, settings: false, update: true, read: true }, searchEngines: false },
			{ slug: mapData.id, comment: READ_LINK_COMMENT, password: false, permissions: { admin: false, settings: false, update: false, read: true }, searchEngines: mapData.searchEngines ?? false }
		];
	}
	return {
		...omit(mapData, ["id", "writeId", "adminId", "searchEngines"]),
		...links ? { links } : {}
	} as any;
}

export function currentMapDataToLegacyV2<M extends Record<keyof any, any>>(mapData: M): ReplaceExistingProperties<
	Omit<M, "id" | "links"> & (
		M extends { links: MapLink[] } ? Pick<LegacyV2MapData, "id" | "writeId" | "adminId" | "searchEngines"> : {}
	) & (
		M extends { activeLink: ActiveMapLink } ? { writable: LegacyV2Writable } : {}
	), {
		defaultView: LegacyV2View | null
	}
> {
	const links = mapData.links as MapLink[] | undefined;
	const activeLink = mapData.activeLink as ActiveMapLink | undefined;
	const legacyLinks = links && {
		read: (
			links.find((l) => !l.permissions.admin && !l.permissions.settings && !l.permissions.update && Object.keys(l.permissions.types ?? {}).length === 0)
			?? links.find((l) => !l.permissions.admin && !l.permissions.settings && !l.permissions.update)
			?? links.find((l) => !l.permissions.admin && !l.permissions.settings)
			?? links.find((l) => !l.permissions.admin)
			?? links[0]
		),
		write: (
			links.find((l) => !l.permissions.admin && !l.permissions.settings && l.permissions.update && Object.keys(l.permissions.types ?? {}).length === 0)
			?? links.find((l) => !l.permissions.admin && !l.permissions.settings && l.permissions.update)
			?? links.find((l) => !l.permissions.admin && !l.permissions.settings)
			?? links.find((l) => !l.permissions.admin)
			?? links[0]
		),
		admin: getMainAdminLink(links)
	};

	return {
		...omit(mapData, ["id", "links"]),
		...legacyLinks ? {
			id: legacyLinks.read.slug,
			writeId: legacyLinks.write.slug,
			adminId: legacyLinks.admin.slug,
			searchEngines: legacyLinks.read.searchEngines
		} : {},
		...activeLink ? {
			writable: activeLink.permissions.admin ? LegacyV2Writable.ADMIN : activeLink.permissions.update ? LegacyV2Writable.WRITE : LegacyV2Writable.READ
		} : {},
		..."defaultView" in mapData ? {
			defaultView: mapData.defaultView && currentViewToLegacyV2(mapData.defaultView, mapData.readId)
		} : {}
	} as any;
}

export function currentDataToLegacyV2(data: Record<ID, string>, type: Type, keepOld = false): Record<string, string> {
	const oldData = dataByFieldIdToDataByName(data, type);
	return keepOld ? Object.assign(oldData, data) : oldData;
}

export function legacyV2DataToCurrent<KeepOld extends boolean = false>(data: Record<string, string>, type: Type, keepOld: KeepOld = false as KeepOld): Record<ID | (KeepOld extends true ? string : never), string> {
	const newData = dataByNameToDataByFieldId(data, type);
	return keepOld ? Object.assign(newData, data) : newData as any;
}

export function legacyV2MarkerToCurrentWithoutData<M extends Record<keyof any, any>, KeepOld extends boolean = false>(marker: M, keepOld?: KeepOld): RenameProperty<M, "symbol", "icon", KeepOld> {
	return renameProperty(marker, "symbol", "icon", keepOld);
}

export function legacyV2MarkerToCurrent<M extends Record<keyof any, any>, KeepOld extends boolean = false>(marker: M, type: Type | undefined, keepOld?: KeepOld): ReplaceExistingProperties<RenameProperty<M, "symbol", "icon", KeepOld>, { data: Record<ID | (KeepOld extends true ? string : never), string> }> {
	const result = legacyV2MarkerToCurrentWithoutData(marker, keepOld);
	if (type && "data" in result) {
		result.data = legacyV2DataToCurrent(result.data, type, keepOld);
	}
	return result as any;
}

export function currentMarkerToLegacyV2<M extends Record<keyof any, any>, KeepOld extends boolean = false>(marker: M, type: Type | undefined, readId: MapSlug, keepOld?: KeepOld): ReplaceExistingProperties<MapIdToLegacyV2<RenameProperty<M, "icon", "symbol", KeepOld>, KeepOld>, { data: Record<string, string> }> {
	const result = mapIdToLegacyV2(renameProperty(marker, "icon", "symbol", keepOld), readId, keepOld);
	if (type && "data" in result) {
		result.data = currentDataToLegacyV2(result.data, type, keepOld);
	}
	return result as any;
}

export function legacyV2LineToCurrent<L extends Record<keyof any, any>, KeepOld extends boolean = false>(line: L, type: Type | undefined, keepOld?: KeepOld): ReplaceExistingProperties<L, { data: Record<ID | (KeepOld extends true ? string : never), string> }> {
	const result = { ...line } as any;
	if (type && "data" in result) {
		result.data = legacyV2DataToCurrent(result.data, type, keepOld);
	}
	return result;
}

export function currentLineToLegacyV2<L extends Record<keyof any, any>, KeepOld extends boolean = false>(line: L, type: Type | undefined, readId: MapSlug, keepOld?: KeepOld): MapIdToLegacyV2<L, KeepOld> {
	const result = mapIdToLegacyV2(line, readId, keepOld);
	if (type && "data" in result) {
		result.data = currentDataToLegacyV2(result.data, type, keepOld);
	}
	return result;
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

export function currentHistoryEntryToLegacyV2(historyEntry: HistoryEntry, readId: MapSlug, getType: (id: ID) => Type | undefined): LegacyV2HistoryEntry;
export function currentHistoryEntryToLegacyV2(historyEntry: HistoryEntry, readId: MapSlug, getType: (id: ID) => Promise<Type | undefined>): Promise<LegacyV2HistoryEntry>;
export function currentHistoryEntryToLegacyV2(historyEntry: HistoryEntry, readId: MapSlug, getType: (id: ID) => Type | undefined | Promise<Type | undefined>): LegacyV2HistoryEntry | Promise<LegacyV2HistoryEntry> {
	let renamed = mapIdToLegacyV2(historyEntry, readId);

	if (renamed.type === "Map") {
		return mapHistoryEntry(renamed, (obj) => obj && currentMapDataToLegacyV2(obj));
	} else if (renamed.type === "Marker") {
		const type = getType(renamed.objectId);
		if (type && "then" in type) {
			return type.then((t) => mapHistoryEntry(renamed, (obj) => obj && currentMarkerToLegacyV2(obj, t, readId)));
		} else {
			return mapHistoryEntry(renamed, (obj) => obj && currentMarkerToLegacyV2(obj, type, readId));
		}
	} else if (renamed.type === "Line") {
		const type = getType(renamed.objectId);
		if (type && "then" in type) {
			return type.then((t) => mapHistoryEntry(renamed, (obj) => obj && currentLineToLegacyV2(obj, t, readId)));
		} else {
			return mapHistoryEntry(renamed, (obj) => obj && currentLineToLegacyV2(obj, type, readId));
		}
	} else if (renamed.type === "Type") {
		return mapHistoryEntry(renamed, (obj) => obj && currentTypeToLegacyV2(obj, readId));
	} else if (renamed.type === "View") {
		return mapHistoryEntry(renamed, (obj) => obj && currentViewToLegacyV2(obj, readId));
	} else {
		return mapHistoryEntry(renamed, (obj) => obj);
	}
}

export function legacyV2RouteRequestToCurrent(data: z.infer<typeof legacyV2RouteRequestValidator>): RouteRequest {
	return {
		routePoints: data.destinations,
		mode: data.mode
	};
}