import { entries, type HistoryEntry, type ID, type Line, type LinePoints, type MapData, type MapLink, type Marker, type ReplaceProperties, type Type, type View } from "facilmap-types";
import { isEqual, pick } from "lodash-es";
import { canAdministrateMap, canReadField, canReadObject, mergeMapPermissions } from "facilmap-utils";

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

export function stripMapData(link: RawMapLink, mapData: RawMapData): MapData {
	return {
		...pick(mapData, ["id", "name", "searchEngines", "description", "clusterMarkers", "legend1", "legend2", "defaultViewId"]),
		activeLink: stripMapLink(link, link)!,
		links: stripMapLinks(link, mapData.links),
		defaultView: mapData.defaultView && stripView(link, mapData.defaultView)
	}
}

export function stripMapLinks(link: RawMapLink, mapLinks: RawMapLink[]): MapLink[] {
	return mapLinks.flatMap((mapLink) => {
		const result = stripMapLink(link, mapLink);
		return result ? [result] : [];
	});
}

export function stripMapLink(link: RawMapLink, mapLink: RawMapLink): MapLink | undefined {
	if (
		canAdministrateMap(link.permissions)
		|| (
			isEqual(mergeMapPermissions(link.permissions, mapLink.permissions), link.permissions)
			&& (!mapLink.password || link.password === mapLink.password)
		)
	) {
		return {
			...pick(mapLink, ["id", "slug", "permissions"]),
			password: !!mapLink.password
		};
	} else {
		return undefined;
	}
}

export function stripType(link: RawMapLink | MapLink, type: Type): Type | undefined {
	if (canReadObject(link.permissions, type.id, true)) {
		return {
			...type,
			fields: type.fields.filter((field) => canReadField(link.permissions, type.id, field.id, true))
		};
	} else {
		return undefined;
	}
}

export function stripView(link: RawMapLink | MapLink, view: View): View {
	return view;
}

export function stripMarker(link: RawMapLink | MapLink, marker: Marker, isOwn: boolean): Marker | undefined {
	if (canReadObject(link.permissions, marker.typeId, isOwn)) {
		return {
			...marker,
			data: stripData(link, marker.typeId, marker.data, isOwn)
		};
	} else {
		return undefined;
	}
}

export function stripLine(link: RawMapLink | MapLink, line: Line, isOwn: boolean): Line | undefined {
	if (canReadObject(link.permissions, line.typeId, isOwn)) {
		return {
			...line,
			data: stripData(link, line.typeId, line.data, isOwn)
		};
	} else {
		return undefined;
	}
}

export function stripLinePoints(link: RawMapLink | MapLink, linePoints: LinePoints & { typeId: ID }, isOwn: boolean): (LinePoints & { typeId: ID }) | undefined {
	if (canReadObject(link.permissions, linePoints.typeId, isOwn)) {
		return linePoints;
	} else {
		return undefined;
	}
}

export function stripData(link: RawMapLink | MapLink, typeId: ID, data: Record<ID, string>, isOwn: boolean): Record<ID, string> {
	return Object.fromEntries(entries(data).filter(([fieldId, value]) => canReadField(link.permissions, typeId, fieldId, isOwn)));
}