import { describe, expect, test } from "vitest";
import { getGradientStops, RAINBOW_STOPS } from "../icons";

describe("getGradientStops", () => {
	test("returns the rainbow stops for \"rainbow\"", () => {
		expect(getGradientStops("rainbow")).toBe(RAINBOW_STOPS);
	});

	test("returns undefined for a single colour", () => {
		expect(getGradientStops("#ff0000")).toBeUndefined();
	});

	test("blends a list of colours with equal shares", () => {
		expect(getGradientStops("#ff0000,#00ff00")).toBe(
			`<stop offset="25%" stop-color="#ff0000"/><stop offset="75%" stop-color="#00ff00"/>`
		);
	});

	test("gives each colour a share proportional to its weight", () => {
		expect(getGradientStops("#888888 10,#ff0000 1")).toBe(
			`<stop offset="45.45%" stop-color="#888888"/><stop offset="95.45%" stop-color="#ff0000"/>`
		);
	});
});
