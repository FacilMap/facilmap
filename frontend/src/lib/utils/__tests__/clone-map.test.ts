import { describe, expect, test, vi } from "vitest";
import { omit } from "lodash-es";
import type { MapData, Type, View } from "facilmap-types";
import { cloneMapStructure, getCloneMapPrefill, rewriteTypeIdsInFilter, stripTypeForCreate, stripViewForCreate } from "../clone-map";

function makeType(overrides: Partial<Type> = {}): Type {
	return {
		id: 10,
		mapId: "read-id",
		type: "marker",
		name: "Place",
		idx: 0,
		defaultColour: "00ff00",
		colourFixed: true,
		defaultSize: 40,
		sizeFixed: false,
		defaultIcon: "star",
		iconFixed: true,
		defaultShape: "circle",
		shapeFixed: false,
		defaultWidth: 4,
		widthFixed: false,
		defaultStroke: "",
		strokeFixed: false,
		defaultMode: "",
		modeFixed: false,
		showInLegend: true,
		fields: [
			{ name: "Description", type: "textarea" },
			{
				name: "Status",
				type: "dropdown",
				controlColour: true,
				showInLegend: true,
				options: [{ value: "Open", colour: "00ff00" }, { value: "Closed", colour: "ff0000" }]
			}
		],
		...overrides
	};
}

function makeView(overrides: Partial<View> = {}): View {
	return {
		id: 20,
		mapId: "read-id",
		name: "Overview",
		idx: 0,
		top: 50,
		bottom: 40,
		left: 0,
		right: 10,
		baseLayer: "Mpnk",
		layers: ["grid"],
		filter: null,
		...overrides
	};
}

const mapData: MapData = {
	id: "read-id",
	writeId: "write-id",
	adminId: "admin-id",
	name: "Original",
	searchEngines: true,
	description: "A map",
	clusterMarkers: true,
	legend1: "Top text",
	legend2: "Bottom text",
	defaultViewId: 20,
	customFunctions: [{ name: "isOpen", formula: { type: "filtrex", code: "prop(data, \"Status\") == \"Open\"" } }],
	routeFormulas: [],
	defaultView: makeView()
};

describe("getCloneMapPrefill", () => {
	test("copies settings with the given name", () => {
		expect(getCloneMapPrefill(mapData, "Copy of Original")).toEqual({
			name: "Copy of Original",
			searchEngines: true,
			description: "A map",
			clusterMarkers: true,
			legend1: "Top text",
			legend2: "Bottom text",
			customFunctions: mapData.customFunctions,
			routeFormulas: []
		});
	});

	test("does not share objects with the source", () => {
		expect(getCloneMapPrefill(mapData, "Copy").customFunctions).not.toBe(mapData.customFunctions);
	});

	test("works for a read-only map without writeId and adminId", () => {
		expect(getCloneMapPrefill(omit(mapData, ["writeId", "adminId"]), "Copy")).toEqual(getCloneMapPrefill(mapData, "Copy"));
	});
});

describe("stripTypeForCreate", () => {
	test("drops id and mapId and keeps everything else", () => {
		const type = makeType();
		const expected = omit(type, ["id", "mapId"]);
		const result = stripTypeForCreate(type);
		expect(result).toEqual(expected);
		expect(result).not.toHaveProperty("id");
		expect(result).not.toHaveProperty("mapId");
	});

	test("does not share fields with the source", () => {
		const type = makeType();
		expect(stripTypeForCreate(type).fields).not.toBe(type.fields);
	});
});

describe("stripViewForCreate", () => {
	const typeIdMap = { 10: 110, 11: 111 };

	test("drops id and mapId", () => {
		const view = makeView();
		const expected = omit(view, ["id", "mapId"]);
		expect(stripViewForCreate(view, typeIdMap)).toEqual({ view: expected, filterDropped: false });
	});

	test("rewrites type IDs in the filter", () => {
		const result = stripViewForCreate(makeView({ filter: "typeId!=10 and not (typeId==11 and prop(data,\"Status\")!=\"Open\")" }), typeIdMap);
		expect(result).toEqual({
			view: expect.objectContaining({ filter: "typeId!=110 and not (typeId==111 and prop(data,\"Status\")!=\"Open\")" }),
			filterDropped: false
		});
	});

	test("keeps a filter without type IDs", () => {
		const result = stripViewForCreate(makeView({ filter: "name == \"Foo\"" }), typeIdMap);
		expect(result.view.filter).toBe("name == \"Foo\"");
		expect(result.filterDropped).toBe(false);
	});

	test("drops a filter that cannot be rewritten", () => {
		const result = stripViewForCreate(makeView({ filter: "typeId > 10" }), typeIdMap);
		expect(result.view.filter).toBeNull();
		expect(result.view.name).toBe("Overview");
		expect(result.filterDropped).toBe(true);
	});
});

describe("rewriteTypeIdsInFilter", () => {
	const typeIdMap = { 1: 101, 2: 102, 12: 112 };

	test.each([
		["typeId == 1", "typeId == 101"],
		["typeId!=2", "typeId!=102"],
		["2 == typeId", "102 == typeId"],
		["typeId in (1, 2)", "typeId in (101, 102)"],
		["typeId not in (1,12)", "typeId not in (101,112)"],
		["(typeId==1 or typeId==2) and name == \"x\"", "(typeId==101 or typeId==102) and name == \"x\""],
		["typeId == 1 ? 1 : 2", "typeId == 101 ? 1 : 2"],
		["name == \"typeId == 1\"", "name == \"typeId == 1\""],
		["", ""]
	])("rewrites %j", (filter, expected) => {
		expect(rewriteTypeIdsInFilter(filter, typeIdMap)).toBe(expected);
	});

	test.each([
		"typeId == 3", // Unknown type
		"typeId in (1, 3)",
		"typeId > 1",
		"typeId == 1 + 1",
		"typeId == 1.5",
		"not typeId == 1",
		"'typeId' == 1",
		"prop(obj, \"typeId\") == 1",
		"data.typeId == 1",
		"typeId == 1 in (true)",
		"x + typeId == 1"
	])("refuses %j", (filter) => {
		expect(rewriteTypeIdsInFilter(filter, typeIdMap)).toBeUndefined();
	});
});

describe("cloneMapStructure", () => {
	const newMapData = { id: "new-read", writeId: "new-write", adminId: "new-admin", name: "Copy" };

	function makeFakeClient({ failAt, failDelete = false }: { failAt?: string; failDelete?: boolean } = {}) {
		let nextId = 100;
		const calls: Array<[string, any]> = [];
		const call = (name: string) => vi.fn(async (data?: any) => {
			calls.push([name, data]);
			if (failAt === name) {
				throw new Error(`${name} failed`);
			}
			if (name === "deleteMap" && failDelete) {
				throw new Error("deleteMap failed");
			}
			return { ...data, id: nextId++ };
		});
		return {
			calls,
			client: {
				createMap: call("createMap"),
				addType: call("addType"),
				addView: call("addView"),
				editMap: call("editMap"),
				deleteMap: call("deleteMap")
			} as any
		};
	}

	const source = {
		defaultViewId: 20,
		types: {
			11: makeType({ id: 11, idx: 1, name: "Second" }),
			10: makeType({ id: 10, idx: 0, name: "First" }),
			12: makeType({ id: 12, idx: 2, name: "Route", type: "line" })
		},
		views: {
			21: makeView({ id: 21, idx: 1, name: "Filtered", filter: "typeId!=11" }),
			20: makeView({ id: 20, idx: 0, name: "Overview" }),
			22: makeView({ id: 22, idx: 2, name: "Odd", filter: "typeId > 10" })
		}
	};

	test("creates map, types in idx order, views with rewritten filters and the default view", async () => {
		const { client, calls } = makeFakeClient();
		const result = await cloneMapStructure(client, newMapData, source);

		expect(result).toEqual({ droppedFilters: 1 });
		expect(calls[0][1]).toEqual({ ...newMapData, defaultViewId: null, createDefaultTypes: false });
		expect(calls.map(([name, data]) => [name, data?.name ?? data?.defaultViewId])).toEqual([
			["createMap", "Copy"],
			["addType", "First"], // → 101
			["addType", "Second"], // → 102
			["addType", "Route"], // → 103
			["addView", "Overview"], // → 104
			["addView", "Filtered"], // → 105
			["addView", "Odd"], // → 106
			["editMap", 104]
		]);
		expect(calls[5][1].filter).toBe("typeId!=102");
		expect(calls[6][1].filter).toBeNull();
		expect(client.deleteMap).not.toHaveBeenCalled();
	});

	test("copies only the selected types and views", async () => {
		const { client, calls } = makeFakeClient();
		const result = await cloneMapStructure(client, newMapData, {
			defaultViewId: 20, // Not selected
			types: [source.types[10], source.types[12]],
			views: [source.views[21]] // Filter references the unselected type 11
		});

		expect(result).toEqual({ droppedFilters: 1 });
		expect(calls.map(([name, data]) => [name, data?.name])).toEqual([
			["createMap", "Copy"],
			["addType", "First"],
			["addType", "Route"],
			["addView", "Filtered"]
		]);
		expect(calls[3][1].filter).toBeNull();
		expect(client.editMap).not.toHaveBeenCalled();
	});

	test("works for a map without types and views", async () => {
		const { client, calls } = makeFakeClient();
		await cloneMapStructure(client, newMapData, { defaultViewId: null, types: {}, views: {} });
		expect(calls.map(([name]) => name)).toEqual(["createMap"]);
	});

	test("does not delete anything if creating the map fails", async () => {
		const { client } = makeFakeClient({ failAt: "createMap" });
		await expect(cloneMapStructure(client, newMapData, source)).rejects.toThrow("createMap failed");
		expect(client.addType).not.toHaveBeenCalled();
		expect(client.deleteMap).not.toHaveBeenCalled();
	});

	test("deletes the new map if a later step fails", async () => {
		const { client } = makeFakeClient({ failAt: "addView" });
		await expect(cloneMapStructure(client, newMapData, source)).rejects.toThrow("addView failed");
		expect(client.deleteMap).toHaveBeenCalledOnce();
		expect(client.editMap).not.toHaveBeenCalled();
	});

	test("reports the original error if the new map cannot be deleted either (connection lost mid-copy)", async () => {
		const { client } = makeFakeClient({ failAt: "addType", failDelete: true });
		await expect(cloneMapStructure(client, newMapData, source)).rejects.toThrow("addType failed");
		expect(client.deleteMap).toHaveBeenCalledOnce();
	});
});
