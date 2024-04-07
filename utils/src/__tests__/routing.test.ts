import { expect, test } from "vitest";
import { decodeRouteQuery, parseRouteQuery } from "../routing";

test("decodeRouteQuery", async () => {
	expect(decodeRouteQuery("Hamburg to Berlin")).toEqual({
		queries: ["Hamburg", "Berlin"],
		mode: null
	});

	expect(decodeRouteQuery("Hamburg to Hannover to Berlin")).toEqual({
		queries: ["Hamburg", "Hannover", "Berlin"],
		mode: null
	});

	expect(decodeRouteQuery("Hamburg to Hannover to Berlin by car")).toEqual({
		queries: ["Hamburg", "Hannover", "Berlin"],
		mode: "car"
	});
});

test("parseRouteQuery", async () => {
	expect(parseRouteQuery("Hamburg to Berlin")).toEqual({
		queries: ["Hamburg", "Berlin"],
		mode: null
	});

	expect(parseRouteQuery("from Hamburg to Berlin")).toEqual({
		queries: ["Hamburg", "Berlin"],
		mode: null
	});

	expect(parseRouteQuery("to Berlin from Hamburg")).toEqual({
		queries: ["Hamburg", "Berlin"],
		mode: null
	});

	expect(parseRouteQuery("Hamburg to Berlin via Hannover")).toEqual({
		queries: ["Hamburg", "Hannover", "Berlin"],
		mode: null
	});

	expect(parseRouteQuery("via Hannover to Berlin from Hamburg")).toEqual({
		queries: ["Hamburg", "Hannover", "Berlin"],
		mode: null
	});

	expect(parseRouteQuery("by walk to Berlin from Hamburg")).toEqual({
		queries: ["Hamburg", "Berlin"],
		mode: "foot"
	});

	expect(parseRouteQuery("from Hamburg by walk to Berlin")).toEqual({
		queries: ["Hamburg", "Berlin"],
		mode: "foot"
	});

	expect(parseRouteQuery("Hamburg to Berlin walking")).toEqual({
		queries: ["Hamburg", "Berlin"],
		mode: "foot"
	});

	expect(parseRouteQuery("Hamburg")).toEqual({
		queries: ["Hamburg"],
		mode: null
	});
});