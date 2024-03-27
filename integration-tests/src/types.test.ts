import { expect, test, vi } from "vitest";
import { createTemporaryPad, openClient, retry } from "./utils";
import { CRU, type Type } from "facilmap-types";
import { cloneDeep } from "lodash-es";

test("Default types are added", async () => {
	const client = await openClient();

	const onType = vi.fn();
	client.on("type", onType);

	await createTemporaryPad(client, {}, async (createPadData, padData, result) => {
		expect(result.type?.length).toBe(2);

		const expectedTypes = [
			{
				fields: [
					{ name: "Description", type: "textarea" }
				],
				id: result.type![0].id,
				name: 'Marker',
				type: 'marker',
				idx: 0,
				defaultColour: 'ff0000',
				colourFixed: false,
				defaultSize: 30,
				sizeFixed: false,
				defaultSymbol: '',
				symbolFixed: false,
				defaultShape: '',
				shapeFixed: false,
				defaultWidth: 4,
				widthFixed: false,
				defaultStroke: '',
				strokeFixed: false,
				defaultMode: '',
				modeFixed: false,
				showInLegend: false,
				padId: padData.id
			},
			{
				fields: [
					{ name: "Description", type: "textarea" }
				],
				id: result.type![1].id,
				name: 'Line',
				type: 'line',
				idx: 1,
				defaultColour: '0000ff',
				colourFixed: false,
				defaultSize: 30,
				sizeFixed: false,
				defaultSymbol: '',
				symbolFixed: false,
				defaultShape: '',
				shapeFixed: false,
				defaultWidth: 4,
				widthFixed: false,
				defaultStroke: '',
				strokeFixed: false,
				defaultMode: '',
				modeFixed: false,
				showInLegend: false,
				padId: padData.id
			}
		] satisfies Array<Type>;

		expect(result.type).toEqual(expectedTypes);

		expect(onType).toBeCalledTimes(expectedTypes.length);
		for (const type of expectedTypes) {
			expect(onType).toBeCalledWith(type);
		}

		expect(client.types).toEqual(Object.fromEntries(expectedTypes.map((t) => [t.id, t])));
	});
});

test("Default types are not added", async () => {
	const client = await openClient();

	await createTemporaryPad(client, { createDefaultTypes: false }, async (createPadData, padData, result) => {
		expect(result.type).toEqual([]);
		expect(client.types).toEqual({});
	});
});

test("Create type (marker, default settings)", async () => {
	const client1 = await openClient();

	await createTemporaryPad(client1, { createDefaultTypes: false }, async (createPadData, padData, result) => {
		const client2 = await openClient(padData.id);

		const onType1 = vi.fn();
		client1.on("type", onType1);

		const onType2 = vi.fn();
		client2.on("type", onType2);

		const type = {
			name: "Test type",
			type: "marker"
		} satisfies Type<CRU.CREATE>;

		const typeResult = await client1.addType(type);

		const expectedType: Type = {
			...type,
			id: typeResult.id,
			padId: padData.id,
			idx: 0,
			defaultColour: "ff0000",
			colourFixed: false,
			defaultSize: 30,
			sizeFixed: false,
			defaultSymbol: "",
			symbolFixed: false,
			defaultShape: "",
			shapeFixed: false,
			defaultWidth: 4,
			widthFixed: false,
			defaultStroke: "",
			strokeFixed: false,
			defaultMode: "",
			modeFixed: false,
			showInLegend: false,
			fields: [
				{ name: "Description", type: "textarea" }
			]
		};

		expect(typeResult).toEqual(expectedType);

		await retry(async () => {
			expect(onType1).toBeCalledTimes(1);
			expect(onType2).toBeCalledTimes(1);
		});

		expect(onType1).toHaveBeenNthCalledWith(1, expectedType);
		expect(cloneDeep(client1.types)).toEqual({
			[expectedType.id]: expectedType
		});

		expect(onType2).toHaveBeenNthCalledWith(1, expectedType);
		expect(cloneDeep(client2.types)).toEqual({
			[expectedType.id]: expectedType
		});

		const client3 = await openClient(padData.id);
		expect(cloneDeep(client3.types)).toEqual({
			[expectedType.id]: expectedType
		});
	});
});

test("Create type (line, default settings)", async () => {
	const client1 = await openClient();

	const onType = vi.fn();
	client1.on("type", onType);

	await createTemporaryPad(client1, { createDefaultTypes: false }, async (createPadData, padData, result) => {
		const client2 = await openClient(padData.id);

		const onType1 = vi.fn();
		client1.on("type", onType1);

		const onType2 = vi.fn();
		client2.on("type", onType2);

		const type = {
			name: "Test type",
			type: "line"
		} satisfies Type<CRU.CREATE>;

		const typeResult = await client1.addType(type);

		const expectedType: Type = {
			...type,
			id: typeResult.id,
			padId: padData.id,
			idx: 0,
			defaultColour: "0000ff",
			colourFixed: false,
			defaultSize: 30,
			sizeFixed: false,
			defaultSymbol: "",
			symbolFixed: false,
			defaultShape: "",
			shapeFixed: false,
			defaultWidth: 4,
			widthFixed: false,
			defaultStroke: "",
			strokeFixed: false,
			defaultMode: "",
			modeFixed: false,
			showInLegend: false,
			fields: [
				{ name: "Description", type: "textarea" }
			]
		};

		expect(typeResult).toEqual(expectedType);

		await retry(async () => {
			expect(onType1).toBeCalledTimes(1);
			expect(onType2).toBeCalledTimes(1);
		});

		expect(onType1).toHaveBeenNthCalledWith(1, expectedType);
		expect(cloneDeep(client1.types)).toEqual({
			[expectedType.id]: expectedType
		});

		expect(onType2).toHaveBeenNthCalledWith(1, expectedType);
		expect(cloneDeep(client2.types)).toEqual({
			[expectedType.id]: expectedType
		});

		const client3 = await openClient(padData.id);
		expect(cloneDeep(client3.types)).toEqual({
			[expectedType.id]: expectedType
		});
	});
});

test("Create type (custom settings)", async () => {
	const client = await openClient();

	const onType = vi.fn();
	client.on("type", onType);

	await createTemporaryPad(client, { createDefaultTypes: false }, async (createPadData, padData, result) => {
		const onType = vi.fn();
		client.on("type", onType);

		const type = {
			name: "Test type",
			type: "marker",
			idx: 4,
			defaultColour: "00ff00",
			colourFixed: true,
			defaultSize: 35,
			sizeFixed: true,
			defaultSymbol: "a",
			symbolFixed: true,
			defaultShape: "star",
			shapeFixed: true,
			defaultWidth: 10,
			widthFixed: true,
			defaultStroke: "dotted",
			strokeFixed: true,
			defaultMode: "car",
			modeFixed: true,
			showInLegend: true,
			fields: [
				{ name: "Test field", type: "input" }
			]
		} satisfies Type<CRU.CREATE>;

		const typeResult = await client.addType(type);

		const expectedType: Type = {
			...type,
			id: typeResult.id,
			padId: padData.id
		};

		expect(typeResult).toEqual(expectedType);

		await retry(async () => {
			expect(onType).toBeCalledTimes(1);
		});

		expect(onType).toHaveBeenNthCalledWith(1, expectedType);
		expect(cloneDeep(client.types)).toEqual({
			[expectedType.id]: expectedType
		});
	});
});

test("Update type", async () => {
	const client1 = await openClient();

	const onType = vi.fn();
	client1.on("type", onType);

	await createTemporaryPad(client1, { createDefaultTypes: false }, async (createPadData, padData, result) => {
		const createdType = await client1.addType({
			name: "Test type",
			type: "marker"
		});

		const client2 = await openClient(padData.id);

		const onType1 = vi.fn();
		client1.on("type", onType1);

		const onType2 = vi.fn();
		client2.on("type", onType2);

		const update = {
			id: createdType.id,
			name: "Test type 2",
			idx: 4,
			defaultColour: "00ff00",
			colourFixed: true,
			defaultSize: 35,
			sizeFixed: true,
			defaultSymbol: "a",
			symbolFixed: true,
			defaultShape: "star",
			shapeFixed: true,
			defaultWidth: 10,
			widthFixed: true,
			defaultStroke: "dotted",
			strokeFixed: true,
			defaultMode: "car",
			modeFixed: true,
			showInLegend: true,
			fields: [
				{ name: "Test field", type: "input" }
			]
		} satisfies Type<CRU.UPDATE>;

		const typeResult = await client1.editType(update);

		const expectedType: Type = {
			...update,
			padId: padData.id,
			type: "marker"
		};

		expect(typeResult).toEqual(expectedType);

		await retry(async () => {
			expect(onType1).toBeCalledTimes(1);
			expect(onType2).toBeCalledTimes(1);
		});

		expect(onType1).toHaveBeenNthCalledWith(1, expectedType);
		expect(cloneDeep(client1.types)).toEqual({
			[expectedType.id]: expectedType
		});

		expect(onType2).toHaveBeenNthCalledWith(1, expectedType);
		expect(cloneDeep(client2.types)).toEqual({
			[expectedType.id]: expectedType
		});

		const client3 = await openClient(padData.id);
		expect(cloneDeep(client3.types)).toEqual({
			[expectedType.id]: expectedType
		});
	});
});

test("Delete type", async () => {
	const client1 = await openClient();

	await createTemporaryPad(client1, { createDefaultTypes: false }, async (createPadData, padData, result) => {
		const type = await client1.addType({
			name: "Test type",
			type: "marker"
		});

		const client2 = await openClient(padData.id);

		const onDeleteType1 = vi.fn();
		client1.on("deleteType", onDeleteType1);

		const onDeleteType2 = vi.fn();
		client2.on("deleteType", onDeleteType2);

		const deletedType = await client1.deleteType({ id: type.id });

		expect(deletedType).toEqual(type);

		await retry(async () => {
			expect(onDeleteType1).toBeCalledTimes(1);
			expect(onDeleteType2).toBeCalledTimes(1);
		});

		expect(onDeleteType1).toHaveBeenNthCalledWith(1, { id: type.id });
		expect(cloneDeep(client1.types)).toEqual({});

		expect(onDeleteType2).toHaveBeenNthCalledWith(1, { id: type.id });
		expect(cloneDeep(client2.types)).toEqual({});

		const client3 = await openClient(padData.id);
		expect(cloneDeep(client3.types)).toEqual({});
	});
});

test("Delete type (existing markers)", async () => {
	const client1 = await openClient();

	await createTemporaryPad(client1, { createDefaultTypes: false }, async (createPadData, padData, result) => {
		const type = await client1.addType({
			name: "Test type",
			type: "marker"
		});

		await client1.addMarker({
			lat: 0,
			lon: 0,
			typeId: type.id
		});

		const client2 = await openClient(padData.id);

		const onDeleteType1 = vi.fn();
		client1.on("deleteType", onDeleteType1);

		const onDeleteType2 = vi.fn();
		client2.on("deleteType", onDeleteType2);

		await expect(async () => {
			await client1.deleteType({ id: type.id });
		}).rejects.toThrowError("This type is in use.");

		expect(onDeleteType1).toBeCalledTimes(0);
		expect(onDeleteType2).toBeCalledTimes(0);
		expect(cloneDeep(client1.types)).toEqual({
			[type.id]: type
		});
		expect(cloneDeep(client2.types)).toEqual({
			[type.id]: type
		});

		const client3 = await openClient(padData.id);
		expect(cloneDeep(client3.types)).toEqual({
			[type.id]: type
		});
	});
});

test("Delete type (existing lines)", async () => {
	const client1 = await openClient();

	await createTemporaryPad(client1, { createDefaultTypes: false }, async (createPadData, padData, result) => {
		const type = await client1.addType({
			name: "Test type",
			type: "line"
		});

		await client1.addLine({
			routePoints: [
				{ lat: 0, lon: 0 },
				{ lat: 1, lon: 1 }
			],
			typeId: type.id
		});

		const client2 = await openClient(padData.id);

		const onDeleteType1 = vi.fn();
		client1.on("deleteType", onDeleteType1);

		const onDeleteType2 = vi.fn();
		client2.on("deleteType", onDeleteType2);

		await expect(async () => {
			await client1.deleteType({ id: type.id });
		}).rejects.toThrowError("This type is in use.");

		expect(onDeleteType1).toBeCalledTimes(0);
		expect(onDeleteType2).toBeCalledTimes(0);
		expect(cloneDeep(client1.types)).toEqual({
			[type.id]: type
		});
		expect(cloneDeep(client2.types)).toEqual({
			[type.id]: type
		});

		const client3 = await openClient(padData.id);
		expect(cloneDeep(client3.types)).toEqual({
			[type.id]: type
		});
	});
});

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

		await retry(() => {
			expect(onMarker).toBeCalledTimes(1);
		});

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

		await retry(() => {
			expect(onLine).toBeCalledTimes(1);
		});

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

		await retry(() => {
			expect(onMarker).toBeCalledTimes(1);
		});

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

		await retry(() => {
			expect(onLine).toBeCalledTimes(1);
		});

		expect(client.lines[line1.id].data).toEqual({
			"Dropdown": "Option 1"
		});
		expect(client.lines[line2.id].data).toEqual({
			"Dropdown": "Option 2 new"
		});
	});
});

// New marker (default values) is created with default settings
// New line (default values) is created with default settings
// Line template is created with default settings
// New marker (custom values) is created with fixed settings
// New line (custom values) is created with fixed settings
// Updated marker settings are overridden by fixed settings
// Updated line settings are overridden by fixed settings
// Fixed settings are applied to existing marker
// Fixed settings are applied to existing line

// New marker has dropdown styles applied (ignoring custom styles)
// New line has dropdown styles applied (ignoring custom styles)
// Line template has dropdown styles applied
// Updated marker has dropdown styles applied (ignoring custom styles)
// Updated line has dropdown styles applied (ignoring custom styles)
// Dropdown styles are applied to existing markers
// Dropdown styles are applied to existing lines

// Move type down
// Move type up