import { describe, expect, test } from "vitest";
import { storageValidator } from "../storage";

describe("storageValidator", () => {
	test("default values", () => {
		expect(storageValidator.parse(undefined)).toEqual({
			zoomToAll: false,
			autoZoom: true,
			favourites: []
		});

		expect(storageValidator.parse({})).toEqual({
			zoomToAll: false,
			autoZoom: true,
			favourites: []
		});
	});

	test("fallback values", () => {
		expect(storageValidator.parse({
			zoomToAll: "invalid",
			autoZoom: "invalid",
			favourites: "invalid"
		})).toEqual({
			zoomToAll: false,
			autoZoom: true,
			favourites: []
		});
	});

	test("valid values", () => {
		const value = {
			zoomToAll: true,
			autoZoom: false,
			favourites: [
				{ mapSlug: "adminId1", mapId: 1, name: "Test map" },
				{ mapSlug: "adminId2", mapId: 2, name: "Test map", customName: "Custom name" }
			]
		};

		expect(storageValidator.parse(value)).toEqual(value);
	});

	test("invalid favourite", () => {
		const favourite1 = { mapSlug: "adminId1", mapId: 1, name: "Test map" };
		const favourite2 = "invalid";
		const favourite3 = { mapSlug: "adminId2", mapId: 2, name: "Test map", customName: "Custom name" }

		expect(storageValidator.parse({
			favourites: [favourite1, favourite2, favourite3]
		})).toMatchObject({
			favourites: [favourite1, favourite3]
		});
	});

	test("legacy favourite", () => {
		expect(storageValidator.parse({
			bookmarks: [
				{ id: "adminId1", mapId: "readId1", name: "Test map" },
				{ id: "adminId2", padId: "readId2", name: "Test map", customName: "Custom name" }
			]
		})).toMatchObject({
			favourites: [
				{ mapSlug: "adminId1", name: "Test map" },
				{ mapSlug: "adminId2", name: "Test map", customName: "Custom name" }
			]
		});
	});
});