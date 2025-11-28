import { describe, expect, test } from "vitest";
import { storageValidator } from "../storage";

describe("storageValidator", () => {
	test("default values", () => {
		expect(storageValidator.parse(undefined)).toEqual({
			zoomToAll: false,
			autoZoom: true,
			routeQueries: true,
			bookmarks: []
		});

		expect(storageValidator.parse({})).toEqual({
			zoomToAll: false,
			autoZoom: true,
			routeQueries: true,
			bookmarks: []
		});
	});

	test("fallback values", () => {
		expect(storageValidator.parse({
			zoomToAll: "invalid",
			autoZoom: "invalid",
			routeQueries: "invalid",
			bookmarks: "invalid"
		})).toEqual({
			zoomToAll: false,
			autoZoom: true,
			routeQueries: true,
			bookmarks: []
		});
	});

	test("valid values", () => {
		const value = {
			zoomToAll: true,
			autoZoom: false,
			routeQueries: false,
			bookmarks: [
				{ id: "adminId1", mapId: "readId1", name: "Test map" },
				{ id: "adminId2", mapId: "readId2", name: "Test map", customName: "Custom name" }
			]
		};

		expect(storageValidator.parse(value)).toEqual(value);
	});

	test("invalid bookmark", () => {
		const bookmark1 = { id: "adminId1", mapId: "readId1", name: "Test map" };
		const bookmark2 = "invalid";
		const bookmark3 = { id: "adminId2", mapId: "readId2", name: "Test map", customName: "Custom name" }

		expect(storageValidator.parse({
			bookmarks: [bookmark1, bookmark2, bookmark3]
		})).toMatchObject({
			bookmarks: [bookmark1, bookmark3]
		});
	});

	test("legacy bookmark", () => {
		expect(storageValidator.parse({
			bookmarks: [
				{ id: "adminId1", mapId: "readId1", name: "Test map" },
				{ id: "adminId2", padId: "readId2", name: "Test map", customName: "Custom name" }
			]
		})).toMatchObject({
			bookmarks: [
				{ id: "adminId1", mapId: "readId1", name: "Test map" },
				{ id: "adminId2", mapId: "readId2", name: "Test map", customName: "Custom name" }
			]
		});
	});
});