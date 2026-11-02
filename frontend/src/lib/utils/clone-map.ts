import type { CRU, ID, MapData, Type, View } from "facilmap-types";
import type Client from "facilmap-client";
import { getOrderedTypes, getOrderedViews } from "facilmap-utils";
import { cloneDeep, omit } from "lodash-es";

/** Returns the values to prefill in the create map dialog when cloning the given map. */
export function getCloneMapPrefill(mapData: MapData, name: string): Partial<MapData<CRU.CREATE>> {
	return {
		name,
		searchEngines: mapData.searchEngines,
		description: mapData.description,
		clusterMarkers: mapData.clusterMarkers,
		legend1: mapData.legend1,
		legend2: mapData.legend2,
		customFunctions: cloneDeep(mapData.customFunctions),
		routeFormulas: cloneDeep(mapData.routeFormulas)
	};
}

export function stripTypeForCreate(type: Type): Type<CRU.CREATE> {
	return omit(cloneDeep(type), ["id", "mapId"]);
}

/**
 * Returns the create data for a copy of the given view. Type IDs in the view filter are replaced using the given old→new
 * mapping. If this is not safely possible, the filter is dropped and filterDropped is true.
 */
export function stripViewForCreate(view: View, typeIdMap: Record<ID, ID>): { view: View<CRU.CREATE>; filterDropped: boolean } {
	const rest = omit(cloneDeep(view), ["id", "mapId"]);
	if (!rest.filter) {
		return { view: rest, filterDropped: false };
	}

	const filter = rewriteTypeIdsInFilter(rest.filter, typeIdMap);
	return {
		view: { ...rest, filter: filter ?? null },
		filterDropped: filter == null
	};
}

/** Things that may stand directly left of a "typeId == 1" or "typeId in (1,2)" comparison without binding tighter than it. */
const LEFT = String.raw`(?<=(?:^|[(,?:]|\band|\bor)\s*)`;
/** Things that may stand directly right of such a comparison without binding tighter than it. */
const RIGHT = String.raw`(?=\s*(?:$|[),?:]|and\b|or\b))`;
const MARKER = "\u0000";

/**
 * Replaces the type IDs in "typeId == 1", "typeId != 1", "1 == typeId" and "typeId (not) in (1, 2)" expressions of the given
 * filter, which covers what the legend writes (see makeTypeFilter()). Returns undefined if the filter references typeId in
 * any other way, or references a type ID that is not in the mapping, since then the filter cannot be safely rewritten.
 */
export function rewriteTypeIdsInFilter(filter: string, typeIdMap: Record<ID, ID>): string | undefined {
	let safe = true;
	const mapId = (oldId: string): string => {
		const newId = typeIdMap[Number(oldId)];
		if (newId == null) {
			safe = false;
			return oldId;
		}
		return `${newId}`;
	};

	// Split into code and string literals, so that "typeId == 1" inside a string is not touched
	const parts = filter.split(/("(?:[^"\\]|\\.)*")/);
	const result = parts.map((part, i) => {
		if (i % 2 === 1) {
			if (part.slice(1, -1) === "typeId") {
				safe = false; // Probably prop(..., "typeId")
			}
			return part;
		}

		const rewritten = part
			.replace(new RegExp(String.raw`${LEFT}typeId(\s*[!=]=\s*)(\d+)${RIGHT}`, "g"), (m, op: string, id: string) => `${MARKER}${op}${mapId(id)}`)
			.replace(new RegExp(String.raw`${LEFT}(\d+)(\s*[!=]=\s*)typeId${RIGHT}`, "g"), (m, id: string, op: string) => `${mapId(id)}${op}${MARKER}`)
			.replace(new RegExp(String.raw`${LEFT}typeId(\s+(?:not\s+)?in\s*)\(([\d\s,]*)\)${RIGHT}`, "g"), (m, op: string, ids: string) => (
				`${MARKER}${op}(${ids.replace(/\d+/g, (id) => mapId(id))})`
			));

		if (rewritten.includes("typeId")) {
			safe = false;
		}
		return rewritten.replaceAll(MARKER, "typeId");
	}).join("");

	return safe ? result : undefined;
}

export type CloneMapClient = Pick<Client, "createMap" | "addType" | "addView" | "editMap" | "deleteMap">;

export interface CloneMapSource {
	/** The default view of the source map, it is set on the copy if that view is copied. */
	defaultViewId: ID | null;
	/** The types to copy. */
	types: Type[] | Record<ID, Type>;
	/** The views to copy. Type filters that reference types that are not copied are dropped. */
	views: View[] | Record<ID, View>;
}

export interface CloneMapResult {
	/** Number of views whose filter was dropped because its type IDs could not be rewritten. */
	droppedFilters: number;
}

/**
 * Creates a new map with the given data and copies the given types and views into it, using a client that is not
 * connected to any map yet. If anything fails after the map was created, the new map is deleted again.
 */
export async function cloneMapStructure(client: CloneMapClient, mapData: MapData<CRU.CREATE>, source: CloneMapSource): Promise<CloneMapResult> {
	await client.createMap({ ...mapData, defaultViewId: null, createDefaultTypes: false });

	try {
		const typeIdMap: Record<ID, ID> = {};
		for (const type of getOrderedTypes(source.types)) {
			const newType = await client.addType(stripTypeForCreate(type));
			typeIdMap[type.id] = newType.id;
		}

		const viewIdMap: Record<ID, ID> = {};
		let droppedFilters = 0;
		for (const view of getOrderedViews(source.views)) {
			const stripped = stripViewForCreate(view, typeIdMap);
			const newView = await client.addView(stripped.view);
			viewIdMap[view.id] = newView.id;
			if (stripped.filterDropped) {
				droppedFilters++;
			}
		}

		const defaultViewId = source.defaultViewId != null ? viewIdMap[source.defaultViewId] : undefined;
		if (defaultViewId != null) {
			await client.editMap({ defaultViewId });
		}

		return { droppedFilters };
	} catch (err) {
		// Best effort, if the connection is gone this fails as well
		await client.deleteMap().catch(() => undefined);
		throw err;
	}
}
