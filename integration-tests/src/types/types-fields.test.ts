import { expect, test, vi } from "vitest";
import { createTemporaryPad, openClient } from "../utils";

test("Rename field (marker type)", async () => {
	const client = await openClient();

	await createTemporaryPad(client, { createDefaultTypes: false }, async (createPadData, padData, result) => {
		const type = await client.addType({
			name: "Test type",
			type: "marker",
			fields: [
				{ name: "Field 1", type: "input" },
				{ name: "Field 2", type: "input" }
			]
		});

		await client.updateBbox({ top: 1, right: 1, bottom: -1, left: -1, zoom: 0 }); // To have marker in bbox

		const marker = await client.addMarker({
			lat: 0,
			lon: 0,
			typeId: type.id,
			data: {
				"Field 1": "value 1",
				"Field 2": "value 2"
			}
		});

		const onMarker = vi.fn();
		client.on("marker", onMarker);

		await client.editType({
			id: type.id,
			fields: [
				{ oldName: "Field 1", name: "Field 1 new", type: "input" },
				{ name: "Field 2", type: "input" }
			]
		});

		expect(onMarker).toBeCalledTimes(1);

		expect(client.markers[marker.id].data).toEqual({
			"Field 1 new": "value 1",
			"Field 2": "value 2"
		});
	});
});

test("Rename field (line type)", async () => {
	const client = await openClient();

	await createTemporaryPad(client, { createDefaultTypes: false }, async (createPadData, padData, result) => {
		const type = await client.addType({
			name: "Test type",
			type: "line",
			fields: [
				{ name: "Field 1", type: "input" },
				{ name: "Field 2", type: "input" }
			]
		});

		const line = await client.addLine({
			routePoints: [
				{ lat: 0, lon: 0 },
				{ lat: 1, lon: 1 }
			],
			typeId: type.id,
			data: {
				"Field 1": "value 1",
				"Field 2": "value 2"
			}
		});

		const onLine = vi.fn();
		client.on("line", onLine);

		await client.editType({
			id: type.id,
			fields: [
				{ oldName: "Field 1", name: "Field 1 new", type: "input" },
				{ name: "Field 2", type: "input" }
			]
		});

		expect(onLine).toBeCalledTimes(1);

		expect(client.lines[line.id].data).toEqual({
			"Field 1 new": "value 1",
			"Field 2": "value 2"
		});
	});
});

test("Rename dropdown option (marker type)", async () => {
	const client = await openClient();

	await createTemporaryPad(client, { createDefaultTypes: false }, async (createPadData, padData, result) => {
		const type = await client.addType({
			name: "Test type",
			type: "marker",
			fields: [
				{ name: "Dropdown", type: "dropdown", options: [ { value: "Option 1" }, { value: "Option 2" } ] },
			]
		});

		await client.updateBbox({ top: 1, right: 1, bottom: -1, left: -1, zoom: 0 }); // To have marker in bbox

		const marker1 = await client.addMarker({
			lat: 0,
			lon: 0,
			typeId: type.id,
			data: {
				"Dropdown": "Option 1"
			}
		});

		const marker2 = await client.addMarker({
			lat: 0,
			lon: 0,
			typeId: type.id,
			data: {
				"Dropdown": "Option 2"
			}
		});

		const onMarker = vi.fn();
		client.on("marker", onMarker);

		await client.editType({
			id: type.id,
			fields: [
				{ name: "Dropdown", type: "dropdown", options: [ { value: "Option 1" }, { oldValue: "Option 2", value: "Option 2 new" } ] }
			]
		});

		expect(onMarker).toBeCalledTimes(1);

		expect(client.markers[marker1.id].data).toEqual({
			"Dropdown": "Option 1"
		});
		expect(client.markers[marker2.id].data).toEqual({
			"Dropdown": "Option 2 new"
		});
	});
});

test("Rename dropdown option (line type)", async () => {
	const client = await openClient();

	await createTemporaryPad(client, { createDefaultTypes: false }, async (createPadData, padData, result) => {
		const type = await client.addType({
			name: "Test type",
			type: "line",
			fields: [
				{ name: "Dropdown", type: "dropdown", options: [ { value: "Option 1" }, { value: "Option 2" } ] },
			]
		});

		const line1 = await client.addLine({
			routePoints: [
				{ lat: 0, lon: 0 },
				{ lat: 1, lon: 1 }
			],
			typeId: type.id,
			data: {
				"Dropdown": "Option 1"
			}
		});

		const line2 = await client.addLine({
			routePoints: [
				{ lat: 0, lon: 0 },
				{ lat: 1, lon: 1 }
			],
			typeId: type.id,
			data: {
				"Dropdown": "Option 2"
			}
		});

		const onLine = vi.fn();
		client.on("line", onLine);

		await client.editType({
			id: type.id,
			fields: [
				{ name: "Dropdown", type: "dropdown", options: [ { value: "Option 1" }, { oldValue: "Option 2", value: "Option 2 new" } ] }
			]
		});

		expect(onLine).toBeCalledTimes(1);

		expect(client.lines[line1.id].data).toEqual({
			"Dropdown": "Option 1"
		});
		expect(client.lines[line2.id].data).toEqual({
			"Dropdown": "Option 2 new"
		});
	});
});

test("Create type with duplicate fields", async () => {
	const client = await openClient();

	await createTemporaryPad(client, { createDefaultTypes: false }, async () => {
		await expect(async () => {
			await client.addType({
				name: "Test type",
				type: "marker",
				fields: [
					{ name: "Field 1", type: "input" },
					{ name: "Field 1", type: "textarea" }
				]
			});
		}).rejects.toThrowError("Field names must be unique.");
	});
});

test("Update type with duplicate fields", async () => {
	const client = await openClient();

	await createTemporaryPad(client, { createDefaultTypes: false }, async () => {
		const type = await client.addType({
			name: "Test type",
			type: "marker",
			fields: [
				{ name: "Field 1", type: "input" },
				{ name: "Field 2", type: "textarea" }
			]
		});

		await expect(async () => {
			await client.editType({
				id: type.id,
				fields: [
					{ name: "Field 1", type: "input" },
					{ name: "Field 1", type: "textarea" }
				]
			});
		}).rejects.toThrowError("Field names must be unique.");
	});
});

test("Create type with duplicate dropdown values", async () => {
	const client = await openClient();

	await createTemporaryPad(client, { createDefaultTypes: false }, async () => {
		await expect(async () => {
			await client.addType({
				name: "Test type",
				type: "marker",
				fields: [
					{
						name: "Dropdown",
						type: "dropdown",
						options: [
							{ value: "Value 1" },
							{ value: "Value 1" }
						]
					}
				]
			});
		}).rejects.toThrowError("Dropdown option values must be unique.");
	});
});

test("Update type with duplicate dropdown values", async () => {
	const client = await openClient();

	await createTemporaryPad(client, { createDefaultTypes: false }, async () => {
		const type = await client.addType({
			name: "Test type",
			type: "marker"
		});

		await expect(async () => {
			await client.editType({
				id: type.id,
				fields: [
					{
						name: "Dropdown",
						type: "dropdown",
						options: [
							{ value: "Value 1" },
							{ value: "Value 1" }
						]
					}
				]
			});
		}).rejects.toThrowError("Dropdown option values must be unique.");
	});
});