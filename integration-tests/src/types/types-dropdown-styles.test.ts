import { expect, test, vi } from "vitest";
import { createTemporaryPad, openClient } from "../utils";

test("New marker is created with dropdown styles", async () => {
	const client = await openClient();

	await createTemporaryPad(client, { createDefaultTypes: false }, async () => {
		const type = await client.addType({
			name: "Test type",
			type: "marker",
			fields: [
				{
					name: "Dropdown",
					type: "dropdown",
					controlColour: true,
					controlSize: true,
					controlSymbol: true,
					controlShape: true,
					options: [
						{ value: "Value 1", colour: "00ffff", size: 60, symbol: "z", shape: "rectangle" },
						{ value: "Value 2", colour: "00ff00", size: 50, symbol: "a", shape: "circle" }
					],
					default: "Value 2"
				}
			]
		});

		const marker = await client.addMarker({
			lat: 0,
			lon: 0,
			typeId: type.id,
			colour: "ffffff",
			size: 20,
			symbol: "b",
			shape: "drop"
		});

		expect(marker).toMatchObject({
			colour: "00ff00",
			size: 50,
			symbol: "a",
			shape: "circle",
		});
	});
});

test("New line is created with dropdown styles", async () => {
	const client = await openClient();

	await createTemporaryPad(client, { createDefaultTypes: false }, async () => {
		const type = await client.addType({
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
		});

		const line = await client.addLine({
			routePoints: [
				{ lat: 0, lon: 0 },
				{ lat: 1, lon: 1 }
			],
			typeId: type.id,
			colour: "ffffff",
			width: 20,
			stroke: "dashed"
		});

		expect(line).toMatchObject({
			colour: "00ff00",
			width: 10,
			stroke: "dotted"
		});
	});
});

test("Line template uses dropdown styles", async () => {
	const client = await openClient();

	await createTemporaryPad(client, { createDefaultTypes: false }, async () => {
		const type = await client.addType({
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
		});

		const lineTemplate = await client.getLineTemplate({
			typeId: type.id
		});

		expect(lineTemplate).toEqual({
			typeId: type.id,
			name: "",
			colour: "00ff00",
			width: 10,
			stroke: "dotted",
			mode: "",
			data: {}
		});
	});
});

test("Marker update is overridden by dropdown styles", async () => {
	const client = await openClient();

	await createTemporaryPad(client, { createDefaultTypes: false }, async () => {
		const type = await client.addType({
			name: "Test type",
			type: "marker",
			fields: [
				{
					name: "Dropdown",
					type: "dropdown",
					controlColour: true,
					controlSize: true,
					controlSymbol: true,
					controlShape: true,
					options: [
						{ value: "Value 1", colour: "00ffff", size: 60, symbol: "z", shape: "rectangle" },
						{ value: "Value 2", colour: "00ff00", size: 50, symbol: "a", shape: "circle" }
					],
					default: "Value 2"
				}
			]
		});

		const marker = await client.addMarker({
			lat: 0,
			lon: 0,
			typeId: type.id,
			data: {
				"Dropdown": "Value 1"
			}
		});

		const markerUpdate = await client.editMarker({
			id: marker.id,
			colour: "ffffff",
			size: 20,
			symbol: "b",
			shape: "drop"
		});

		expect(markerUpdate).toMatchObject({
			colour: "00ffff",
			size: 60,
			symbol: "z",
			shape: "rectangle",
		});
	});
});

test("Line update is overridden by dropdown styles", async () => {
	const client = await openClient();

	await createTemporaryPad(client, { createDefaultTypes: false }, async () => {
		const type = await client.addType({
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
		});

		const line = await client.addLine({
			routePoints: [
				{ lat: 0, lon: 0 },
				{ lat: 1, lon: 1 }
			],
			typeId: type.id,
			data: {
				"Dropdown": "Value 1"
			}
		});

		const lineUpdate = await client.editLine({
			id: line.id,
			colour: "ffff00",
			width: 20,
			stroke: ""
		});

		expect(lineUpdate).toMatchObject({
			colour: "00ffff",
			width: 11,
			stroke: "dashed"
		});
	});
});

test("New dropdown styles are applied to existing markers", async () => {
	const client = await openClient();

	await createTemporaryPad(client, { createDefaultTypes: false }, async () => {
		const type = await client.addType({
			name: "Test type",
			type: "marker"
		});

		await client.updateBbox({ top: 1, right: 1, bottom: -1, left: -1, zoom: 0 }); // To have marker in bbox

		const marker = await client.addMarker({
			lat: 0,
			lon: 0,
			typeId: type.id,
			colour: "ffffff",
			size: 20,
			symbol: "b",
			shape: "drop"
		});

		const onMarker = vi.fn();
		client.on("marker", onMarker);

		await client.editType({
			id: type.id,
			fields: [
				{
					name: "Dropdown",
					type: "dropdown",
					controlColour: true,
					controlSize: true,
					controlSymbol: true,
					controlShape: true,
					options: [
						{ value: "Value 1", colour: "00ffff", size: 60, symbol: "z", shape: "rectangle" },
						{ value: "Value 2", colour: "00ff00", size: 50, symbol: "a", shape: "circle" }
					],
					default: "Value 2"
				}
			]
		});

		expect(onMarker).toBeCalledTimes(1);

		expect(client.markers[marker.id]).toMatchObject({
			colour: "00ff00",
			size: 50,
			symbol: "a",
			shape: "circle",
		});
	});
});

test("New dropdown styles are applied to existing lines", async () => {
	const client = await openClient();

	await createTemporaryPad(client, { createDefaultTypes: false }, async () => {
		const type = await client.addType({
			name: "Test type",
			type: "line"
		});

		const line = await client.addLine({
			routePoints: [
				{ lat: 0, lon: 0 },
				{ lat: 1, lon: 1 }
			],
			typeId: type.id,
			colour: "ffffff",
			width: 20,
			stroke: "dashed",
			mode: ""
		});

		const onLine = vi.fn();
		client.on("line", onLine);

		await client.editType({
			id: type.id,
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
		});

		expect(onLine).toBeCalledTimes(1);

		expect(client.lines[line.id]).toMatchObject({
			colour: "00ff00",
			width: 10,
			stroke: "dotted"
		});
	});
});