import { expect, test } from "vitest";
import { decodeRouteQuery, encodeRouteQuery, parseRouteQuery } from "../routing";

test("encodeRouteQuery", async () => {
	expect(encodeRouteQuery({
		queries: ["Hamburg", "Berlin"],
		mode: null
	})).toEqual("Hamburg to Berlin");

	expect(encodeRouteQuery({
		queries: ["Hamburg", "Hannover", "Berlin"],
		mode: null
	})).toEqual("Hamburg to Hannover to Berlin");

	expect(encodeRouteQuery({
		queries: ["Hamburg", "Hannover", "Berlin"],
		mode: "car"
	})).toEqual("Hamburg to Hannover to Berlin by car");

	expect(encodeRouteQuery({
		queries: ["Test To Test", "To", "To Test", "Test To", "Test \" Test \\ Test", "Test to \" Test to \\ Test"],
		mode: "by"
	})).toEqual("\"Test To Test\" to \"To\" to \"To Test\" to \"Test To\" to \"Test \\\" Test \\\\ Test\" to \"Test to \\\" Test to \\\\ Test\" by \"by\"");
});

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

	expect(decodeRouteQuery("\"Test To Test\" To \"To\" to \"To Test\" to \"Test To\" to \"Test \\\" Test \\\\ Test\" to \"Test to \\\" Test to \\\\ Test\" to Test \"to\" Test by \"by\"")).toEqual({
		queries: ["Test To Test", "To", "To Test", "Test To", "Test \" Test \\ Test", "Test to \" Test to \\ Test", "Test to Test"],
		mode: "by"
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
		mode: "pedestrian"
	});

	expect(parseRouteQuery("from Hamburg by walk to Berlin")).toEqual({
		queries: ["Hamburg", "Berlin"],
		mode: "pedestrian"
	});

	expect(parseRouteQuery("Hamburg to Berlin walking")).toEqual({
		queries: ["Hamburg", "Berlin"],
		mode: "pedestrian"
	});

	expect(parseRouteQuery("Hamburg")).toEqual({
		queries: ["Hamburg"],
		mode: null
	});

	expect(parseRouteQuery("\"Test To Test\" To \"To\" to \"To Test\" to \"Test To\" to \"Test \\\" Test \\\\ Test\" to \"Test to \\\" Test to \\\\ Test\" to Test \"to\" Test by walk")).toEqual({
		queries: ["Test To Test", "To", "To Test", "Test To", "Test \" Test \\ Test", "Test to \" Test to \\ Test", "Test to Test"],
		mode: "pedestrian"
	});
});