import { entries, markStripped, type FindOnMapResult, type HistoryEntry, type HistoryEntryObjectTypes, type ID, type Line, type LinePoints, type MapData, type MapLink, type Marker, type ReplaceProperties, type Stripped, type Type, type View } from "facilmap-types";
import { isEqual, omit, pick } from "lodash-es";
import { canAdministrateMap, canReadField, canReadObject, canUpdateField, checkReadObject, hasPermission, mergeMapPermissions, type Optional } from "facilmap-utils";

export type RawMapData = Omit<MapData, "links" | "activeLink"> & {
	links: RawMapLink[];
	salt: Buffer;
	jwtSecret: Buffer;
	nextFieldId: ID;
};

export type RawMapLink = Omit<MapLink, "password"> & {
	id: ID;
	mapId: ID;
	password: Buffer | null;
	tokenHash: string;
};

export type RawHistoryEntryMapData = Omit<MapData, "id" | "defaultView" | "activeLink" | "links"> & {
	links: Array<Omit<RawMapLink, "mapId">>
};
export type RawHistoryEntry = (
	| Exclude<HistoryEntry, { type: "Map" }>
	| (ReplaceProperties<Extract<HistoryEntry, { type: "Map"; action: "create" }>, { objectAfter: RawHistoryEntryMapData }>)
	| (ReplaceProperties<Extract<HistoryEntry, { type: "Map"; action: "update" }>, { objectBefore: RawHistoryEntryMapData; objectAfter: RawHistoryEntryMapData }>)
	| (ReplaceProperties<Extract<HistoryEntry, { type: "Map"; action: "delete" }>, { objectBefore: RawHistoryEntryMapData }>)
);

function stripOrUndefined<T>(strip: () => T): T | undefined {
	let result;
	if (hasPermission(() => {
		result = strip();
	})) {
		return result;
	} else {
		return undefined;
	}
}

export function stripMapData(link: RawMapLink, mapData: RawMapData): Stripped<MapData> {
	return markStripped({
		...pick(mapData, ["id", "name", "description", "clusterMarkers", "legend1", "legend2", "defaultViewId"]),
		activeLink: stripMapLink(link, link)!,
		links: stripMapLinks(link, mapData.links),
		defaultView: mapData.defaultView && (stripView(link, mapData.defaultView) ?? null)
	});
}

export function stripHistoryEntryMapData(link: RawMapLink, mapData: RawHistoryEntryMapData): Stripped<HistoryEntryObjectTypes["Map"]> {
	return markStripped({
		...pick(mapData, ["name", "description", "clusterMarkers", "legend1", "legend2", "defaultViewId"]),
		links: stripMapLinks(link, mapData.links)
	});
}

export function stripMapLinks(link: RawMapLink, mapLinks: Array<Optional<RawMapLink, "mapId">>): Array<Stripped<MapLink>> {
	return mapLinks.flatMap((mapLink) => {
		const result = stripMapLink(link, mapLink);
		return result ? [result] : [];
	});
}

export function stripMapLink(link: RawMapLink, mapLink: Optional<RawMapLink, "mapId">): Stripped<MapLink> | undefined {
	if (
		canAdministrateMap(link.permissions)
		|| (
			isEqual(mergeMapPermissions(link.permissions, mapLink.permissions), link.permissions)
			&& (!mapLink.password || link.password === mapLink.password)
		)
	) {
		return markStripped({
			...pick(mapLink, ["id", "slug", "permissions", "searchEngines"]),
			password: !!mapLink.password
		});
	} else {
		return undefined;
	}
}

export function stripTypeOrThrow<T extends Optional<Type, "mapId">>(link: RawMapLink | MapLink, type: T): Stripped<T> {
	checkReadObject(link.permissions, type.id, true);

	return markStripped({
		...type,
		fields: type.fields.filter((field) => canReadField(link.permissions, type.id, field.id, true))
	});
}

export function stripType<T extends Optional<Type, "mapId">>(link: RawMapLink | MapLink, type: T): Stripped<T> | undefined {
	return stripOrUndefined(() => stripTypeOrThrow(link, type));
}

export function stripViewOrThrow<V extends Optional<View, "id" | "mapId">>(link: RawMapLink | MapLink, view: V): Stripped<V> {
	return markStripped(view);
}

export function stripView<V extends Optional<View, "id" | "mapId">>(link: RawMapLink | MapLink, view: V): Stripped<V> | undefined {
	return stripOrUndefined(() => stripViewOrThrow(link, view));
}

export function stripMarkerOrThrow<M extends Optional<Marker, "id" | "mapId">>(link: RawMapLink | MapLink, marker: M, isOwn: boolean): Stripped<M> {
	checkReadObject(link.permissions, marker.typeId, isOwn);

	return markStripped({
		...marker,
		data: stripData(link, marker.typeId, marker.data, isOwn)
	});
}

export function stripMarker<M extends Optional<Marker, "id" | "mapId">>(link: RawMapLink | MapLink, marker: M, isOwn: boolean): Stripped<M> | undefined {
	return stripOrUndefined(() => stripMarkerOrThrow(link, marker, isOwn));
}

export function stripLineOrThrow<L extends Optional<Line, "id" | "mapId">>(link: RawMapLink | MapLink, line: L, isOwn: boolean): Stripped<L> {
	checkReadObject(link.permissions, line.typeId, isOwn);

	return markStripped({
		...line,
		data: stripData(link, line.typeId, line.data, isOwn)
	});
}

export function stripLine<L extends Optional<Line, "id" | "mapId">>(link: RawMapLink | MapLink, line: L, isOwn: boolean): Stripped<L> | undefined {
	return stripOrUndefined(() => stripLineOrThrow(link, line, isOwn));
}

export function stripLinePoints(link: RawMapLink | MapLink, linePoints: LinePoints & { typeId: ID }, isOwn: boolean): (Stripped<LinePoints & { typeId: ID }>) | undefined {
	if (canReadObject(link.permissions, linePoints.typeId, isOwn)) {
		return markStripped(linePoints);
	} else {
		return undefined;
	}
}

export function stripData(link: RawMapLink | MapLink, typeId: ID, data: Record<ID, string>, isOwn: boolean): Record<ID, string> {
	return Object.fromEntries(entries(data).filter(([fieldId, value]) => canReadField(link.permissions, typeId, fieldId, isOwn)));
}

export function stripDataUpdate(link: RawMapLink | MapLink, typeId: ID, data: Record<ID, string>, isOwn: boolean): Record<ID, string> {
	return Object.fromEntries(entries(data).filter(([fieldId, value]) => canUpdateField(link.permissions, typeId, fieldId, isOwn)));
}

export function stripMapResult(link: RawMapLink | MapLink, result: FindOnMapResult, isOwn: boolean): Stripped<FindOnMapResult> | undefined {
	if (canReadObject(link.permissions, result.typeId, isOwn)) {
		return markStripped(result);
	} else {
		return undefined;
	}
}

export function stripHistoryEntry(link: RawMapLink, entry: RawHistoryEntry, isOwn: boolean): Stripped<HistoryEntry> | undefined {
	if (entry.type === "Map") {
		return markStripped({
			...entry,
			objectBefore: entry.objectBefore && stripHistoryEntryMapData(link, entry.objectBefore) satisfies HistoryEntryObjectTypes["Map"] as any,
			objectAfter: entry.objectAfter && stripHistoryEntryMapData(link, entry.objectAfter) satisfies HistoryEntryObjectTypes["Map"] as any
		});
	} else if (entry.type === "Type") {
		if (canReadObject(link.permissions, entry.objectId, true)) {
			return markStripped({
				...entry,
				objectBefore: entry.objectBefore && omit(stripType(link, { ...entry.objectBefore, id: entry.objectId }), ["id"]) satisfies HistoryEntryObjectTypes["Type"] as any,
				objectAfter: entry.objectAfter && omit(stripType(link, { ...entry.objectAfter, id: entry.objectId }), ["id"]) satisfies HistoryEntryObjectTypes["Type"] as any
			});
		} else {
			return undefined;
		}
	} else if (entry.type === "View") {
		return markStripped({
			...entry,
			objectBefore: entry.objectBefore && stripView(link, entry.objectBefore)! satisfies HistoryEntryObjectTypes["View"] as any,
			objectAfter: entry.objectAfter && stripView(link, entry.objectAfter)! satisfies HistoryEntryObjectTypes["View"] as any
		});
	} else if (entry.type === "Marker") {
		if (
			(!entry.objectBefore || canReadObject(link.permissions, entry.objectBefore.typeId, isOwn))
			|| (!entry.objectAfter || canReadObject(link.permissions, entry.objectAfter.typeId, isOwn))
		) {
			return markStripped({
				...entry,
				objectBefore: entry.objectBefore && stripMarker(link, entry.objectBefore, isOwn)! satisfies HistoryEntryObjectTypes["Marker"] as any,
				objectAfter: entry.objectAfter && stripMarker(link, entry.objectAfter, isOwn)! satisfies HistoryEntryObjectTypes["Marker"] as any
			});
		} else {
			return undefined;
		}
	} else if (entry.type === "Line") {
		if (
			(!entry.objectBefore || canReadObject(link.permissions, entry.objectBefore.typeId, isOwn))
			|| (!entry.objectAfter || canReadObject(link.permissions, entry.objectAfter.typeId, isOwn))
		) {
			return markStripped({
				...entry,
				objectBefore: entry.objectBefore && stripLine(link, entry.objectBefore, isOwn)! satisfies HistoryEntryObjectTypes["Line"] as any,
				objectAfter: entry.objectAfter && stripLine(link, entry.objectAfter, isOwn)! satisfies HistoryEntryObjectTypes["Line"] as any
			});
		} else {
			return undefined;
		}
	} else {
		return undefined;
	}
}