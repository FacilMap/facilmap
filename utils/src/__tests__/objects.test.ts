import { typeValidator, type Type } from "facilmap-types";
import { expect, test } from "vitest";
import { getLineTemplate } from "../objects";

test("Line template uses dropdown styles", async () => {
	const type: Type = {
		...typeValidator.create.parse({
			name: "Test type",
			type: "line",
			fields: [
				{
					name: "Dropdown",
					type: "dropdown",
					controlColour: true,
					controlWidth: true,
					controlStroke: true,
					options: [
						{ value: "Value 1", colour: "00ffff", width: 11, stroke: "dashed" },
						{ value: "Value 2", colour: "00ff00", width: 10, stroke: "dotted" }
					],
					default: "Value 2"
				}
			]
		}),
		id: 1,
		mapId: 1,
		idx: 1
	};

	expect(getLineTemplate(type)).toEqual({
		typeId: type.id,
		name: "",
		colour: "00ff00",
		width: 10,
		stroke: "dotted",
		mode: "",
		data: {}
	});
});

test("Line template uses default settings", async () => {
	const type: Type = {
		...typeValidator.create.parse({
			name: "Test type",
			type: "line",
			defaultColour: "00ff00",
			defaultWidth: 10,
			defaultStroke: "dotted",
			defaultMode: "straight"
		}),
		id: 1,
		mapId: 1,
		idx: 1
	};

	expect(getLineTemplate(type)).toEqual({
		typeId: type.id,
		name: "",
		colour: "00ff00",
		width: 10,
		stroke: "dotted",
		mode: "straight",
		data: {}
	});
});