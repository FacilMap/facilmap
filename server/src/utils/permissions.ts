import { entries, isMapToken, markStripped, type ActiveMapLink, type FindOnMapResult, type GenericHistoryEntry, type HistoryEntry, type HistoryEntryObjectTypes, type HistoryEntryType, type ID, type Line, type LinePoints, type MapData, type MapLink, type MapSlug, type Marker, type ReplaceProperties, type Stripped, type Type, type View } from "facilmap-types";
import { isEqual, omit, pick } from "lodash-es";
import { canAdministrateMap, canReadField, canReadObject, canUpdateField, checkReadObject, hasPermission, mergeMapPermissions, type Optional } from "facilmap-utils";
import { getIdentityHash, getMapIdFromMapTokenUnverified, getPasswordHash, getPasswordHashHash, getSlugHash, verifyMapToken } from "./crypt";
import { getI18n } from "../i18n";

export type RawMapData = Omit<MapData, "links" | "activeLink"> & {
	links: RawMapLink[];
	salt: Buffer;
	jwtSecret: Buffer;
	nextFieldId: ID;
};

export type RawMapLink = Omit<MapLink, "password"> & {
	mapId: ID;
	password: Buffer | null;
};

export type RawActiveMapLink = Optional<RawMapLink, "id"> & {
	identity?: Buffer;
};

export type RawMarker = Omit<Marker, "own"> & {
	identity: Buffer | null;
};

export type RawLine = Omit<Line, "own"> & {
	identity: Buffer | null;
};

export type RawHistoryEntryObjectTypes = ReplaceProperties<HistoryEntryObjectTypes, {
	Map: Omit<MapData, "id" | "defaultView" | "activeLink" | "links"> & {
		links: Array<Omit<RawMapLink, "mapId">>
	};
	Marker: Omit<RawMarker, "id" | "mapId">;
	Line: Omit<RawLine, "id" | "mapId">;
}>;
export type RawHistoryEntry = GenericHistoryEntry<RawHistoryEntryObjectTypes> & {
	identity: Buffer | null;
};
export type RawHistoryEntryObject<T extends HistoryEntryType> = RawHistoryEntryObjectTypes[T];

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

export function stripMapData(link: RawActiveMapLink, mapData: RawMapData): Stripped<MapData> {
	return markStripped({
		...pick(mapData, ["id", "name", "description", "clusterMarkers", "legend1", "legend2", "defaultViewId"]),
		activeLink: stripStoredMapLink(link, link)!,
		links: stripStoredMapLinks(link, mapData.links),
		defaultView: mapData.defaultView && (stripView(link, mapData.defaultView) ?? null)
	});
}

export function stripHistoryEntryMapData(link: RawActiveMapLink, mapData: RawHistoryEntryObjectTypes["Map"]): Stripped<HistoryEntryObjectTypes["Map"]> {
	return markStripped({
		...pick(mapData, ["name", "description", "clusterMarkers", "legend1", "legend2", "defaultViewId"]),
		links: stripStoredMapLinks(link, mapData.links)
	});
}

export function stripStoredMapLinks<L extends Optional<RawMapLink, "id" | "mapId">>(link: RawActiveMapLink, mapLinks: L[]): Array<Stripped<Omit<MapLink, "id"> & { id: L["id"] }>> {
	if (link.id == null) {
		// Token link, hide all map links
		return [];
	}

	return mapLinks.flatMap((mapLink) => {
		const result = stripStoredMapLink(link, mapLink);
		return result ? [result] : [];
	});
}

export function stripStoredMapLink<L extends Optional<RawMapLink, "id" | "mapId">>(link: RawActiveMapLink, mapLink: L): Stripped<Omit<MapLink, "id"> & { id: L["id"] }> | undefined {
	if (
		canAdministrateMap(link.permissions)
		|| (
			isEqual(mergeMapPermissions(link.permissions, mapLink.permissions), link.permissions)
			&& (!mapLink.password || link.password === mapLink.password)
		)
	) {
		return markStripped({
			...pick(mapLink, ["slug", "permissions", "searchEngines"]),
			password: !!mapLink.password,
			...mapLink.id != null ? { id: mapLink.id } : {} as { id: L["id"] }
		});
	} else {
		return undefined;
	}
}

export function stripMapLink(link: RawActiveMapLink): Stripped<ActiveMapLink> {
	return markStripped({
		...pick(link, ["slug", "permissions", "searchEngines"]),
		password: !!link.password,
		...link.id != null ? { id: link.id } : {}
	});
}

export function stripTypeOrThrow<T extends Optional<Type, "mapId">>(link: RawActiveMapLink | Optional<MapLink, "id">, type: T): Stripped<T> {
	checkReadObject(link.permissions, type.id, true);

	return markStripped({
		...type,
		fields: type.fields.filter((field) => canReadField(link.permissions, type.id, field.id, true))
	});
}

export function stripType<T extends Optional<Type, "mapId">>(link: RawActiveMapLink | Optional<MapLink, "id">, type: T): Stripped<T> | undefined {
	return stripOrUndefined(() => stripTypeOrThrow(link, type));
}

export function stripViewOrThrow<V extends Optional<View, "id" | "mapId">>(link: RawActiveMapLink | Optional<MapLink, "id">, view: V): Stripped<V> {
	return markStripped(view);
}

export function stripView<V extends Optional<View, "id" | "mapId">>(link: RawActiveMapLink | Optional<MapLink, "id">, view: V): Stripped<V> | undefined {
	return stripOrUndefined(() => stripViewOrThrow(link, view));
}

export function stripMarkerOrThrow<M extends Optional<RawMarker, "id" | "mapId">>(link: RawActiveMapLink, marker: M, isOwn: boolean): Stripped<Omit<Marker, "id" | "mapId"> & Pick<M, "id" | "mapId">> {
	checkReadObject(link.permissions, marker.typeId, isOwn);

	return markStripped({
		...omit(marker, ["identity"]),
		data: stripData(link, marker.typeId, marker.data, isOwn),
		own: link.identity != null && marker.identity != null && link.identity.equals(marker.identity)
	});
}

export function stripMarker<M extends Optional<RawMarker, "id" | "mapId">>(link: RawActiveMapLink, marker: M, isOwn: boolean): Stripped<Omit<Marker, "id" | "mapId"> & Pick<M, "id" | "mapId">> | undefined {
	return stripOrUndefined(() => stripMarkerOrThrow(link, marker, isOwn));
}

export function stripLineOrThrow<L extends Optional<RawLine, "id" | "mapId">>(link: RawActiveMapLink, line: L, isOwn: boolean): Stripped<Omit<Line, "id" | "mapId"> & Pick<L, "id" | "mapId">> {
	checkReadObject(link.permissions, line.typeId, isOwn);

	return markStripped({
		...omit(line, ["identity"]),
		data: stripData(link, line.typeId, line.data, isOwn),
		own: link.identity != null && line.identity != null && link.identity.equals(line.identity)
	});
}

export function stripLine<L extends Optional<RawLine, "id" | "mapId">>(link: RawActiveMapLink, line: L, isOwn: boolean): Stripped<Omit<Line, "id" | "mapId"> & Pick<L, "id" | "mapId">> | undefined {
	return stripOrUndefined(() => stripLineOrThrow(link, line, isOwn));
}

export function stripLinePoints(link: RawActiveMapLink | Optional<MapLink, "id">, linePoints: LinePoints & { typeId: ID }, isOwn: boolean): (Stripped<LinePoints & { typeId: ID }>) | undefined {
	if (canReadObject(link.permissions, linePoints.typeId, isOwn)) {
		return markStripped(linePoints);
	} else {
		return undefined;
	}
}

export function stripData(link: RawActiveMapLink | Optional<MapLink, "id">, typeId: ID, data: Record<ID, string>, isOwn: boolean): Record<ID, string> {
	return Object.fromEntries(entries(data).filter(([fieldId, value]) => canReadField(link.permissions, typeId, fieldId, isOwn)));
}

export function stripDataUpdate(link: RawActiveMapLink | Optional<MapLink, "id">, typeId: ID, data: Record<ID, string>, isOwn: boolean): Record<ID, string> {
	return Object.fromEntries(entries(data).filter(([fieldId, value]) => canUpdateField(link.permissions, typeId, fieldId, isOwn)));
}

export function stripMapResult(link: RawActiveMapLink | Optional<MapLink, "id">, result: FindOnMapResult, isOwn: boolean): Stripped<FindOnMapResult> | undefined {
	if (canReadObject(link.permissions, result.typeId, isOwn)) {
		return markStripped(result);
	} else {
		return undefined;
	}
}

export function stripHistoryEntry(link: RawActiveMapLink, entry: RawHistoryEntry, isOwn: boolean): Stripped<HistoryEntry> | undefined {
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

export async function resolveMapLinkAsync(
	mapSlug: MapSlug,
	password: Buffer | string | null | undefined,
	identity: Buffer | string | undefined,
	getMapDataById: (mapId: ID) => Promise<RawMapData>,
	getMapDataBySlug: (mapSlug: MapSlug) => Promise<RawMapData>
): Promise<{ rawMapData: RawMapData; activeLink: RawActiveMapLink }> {
	let rawMapData;
	if (isMapToken(mapSlug)) {
		const mapIdUnverified = getMapIdFromMapTokenUnverified(mapSlug);
		rawMapData = await getMapDataById(mapIdUnverified);
	} else {
		rawMapData = await getMapDataBySlug(mapSlug);
	}
	const [passwordHash, identityHash] = await Promise.all([
		typeof password === "string" ? await getPasswordHash(password, rawMapData.salt) : (password ?? null),
		typeof identity === "string" ? getIdentityHash(identity, rawMapData.salt) : identity
	]);
	return {
		rawMapData,
		activeLink: resolveMapLink(mapSlug, passwordHash, identityHash, rawMapData)
	};
}

export function resolveMapLink(mapSlug: MapSlug, password: Buffer | null, identity: Buffer | undefined, rawMapData: RawMapData): RawActiveMapLink {
	let links;
	if (isMapToken(mapSlug)) {
		const token = verifyMapToken(mapSlug, rawMapData.jwtSecret);

		links = rawMapData.links.flatMap((link) => {
			if (
				getSlugHash(link.slug, rawMapData.salt) === token.slugHash
				&& (!token.passwordHash || (link.password && getPasswordHashHash(link.password, rawMapData.salt) === token.passwordHash))
			) {
				return [{
					mapId: link.mapId,
					slug: mapSlug,
					password: token.passwordHash ? null : link.password,
					searchEngines: false,
					permissions: mergeMapPermissions(link.permissions, token.permissions)
				}];
			} else {
				return [];
			}
		});
	} else {
		links = rawMapData.links.filter((link) => link.slug === mapSlug);
	}

	if (links.length === 0) {
		throw Object.assign(new Error(getI18n().t("map-not-found-error", { mapId: mapSlug })), { status: 404 });
	}

	const activeLink = links.find((link) => (
		(link.password == null && password == null)
		|| (link.password != null && password != null && link.password.equals(password))
	));
	if (!activeLink) {
		throw Object.assign(new Error(password == null ? getI18n().t("password-required") : getI18n().t("wrong-password")), {
			status: 401,
			headers: {
				"WWW-Authenticate": `Basic realm="${encodeURIComponent(mapSlug)}", charset="UTF-8`
			}
		});
	}
	return {
		...activeLink,
		identity
	};
}