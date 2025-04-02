import { expect, test, vi } from "vitest";
import { createTemporaryMapV2, openClientV2, retry } from "../../utils";
import { CRU, SocketVersion, type ID, type LegacyV2Type } from "facilmap-types";
import { cloneDeep } from "lodash-es";

test("Default types are added", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	const onType = vi.fn();
	client.on("type", onType);

	await createTemporaryMapV2(client, {}, async (createMapData, mapData, result) => {
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
				padId: mapData.id
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
				padId: mapData.id
			}
		] satisfies Array<LegacyV2Type>;

		expect(result.type).toEqual(expectedTypes);

		expect(onType).toBeCalledTimes(expectedTypes.length);
		for (const type of expectedTypes) {
			expect(onType).toBeCalledWith(type);
		}

		expect(client.types).toEqual(Object.fromEntries(expectedTypes.map((t) => [t.id, t])));
	});
});

test("Default types are not added", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, { createDefaultTypes: false }, async (createMapData, mapData, result) => {
		expect(result.type).toEqual(undefined);
		expect(client.types).toEqual({});
	});
});

test("Create type (marker, default settings)", async () => {
	const client1 = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client1, { createDefaultTypes: false }, async (createMapData, mapData, result) => {
		const client2 = await openClientV2(mapData.id, SocketVersion.V2);

		const onType1 = vi.fn();
		client1.on("type", onType1);

		const onType2 = vi.fn();
		client2.on("type", onType2);

		const type = {
			name: "Test type",
			type: "marker"
		} satisfies LegacyV2Type<CRU.CREATE>;

		const typeResult = await client1.addType(type);

		const expectedType: LegacyV2Type = {
			...type,
			id: typeResult.id,
			padId: mapData.id,
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

		const client3 = await openClientV2(mapData.id, SocketVersion.V2);
		expect(cloneDeep(client3.types)).toEqual({
			[expectedType.id]: expectedType
		});
	});
});

test("Create type (line, default settings)", async () => {
	const client1 = await openClientV2(undefined, SocketVersion.V2);

	const onType = vi.fn();
	client1.on("type", onType);

	await createTemporaryMapV2(client1, { createDefaultTypes: false }, async (createMapData, mapData, result) => {
		const client2 = await openClientV2(mapData.id, SocketVersion.V2);

		const onType1 = vi.fn();
		client1.on("type", onType1);

		const onType2 = vi.fn();
		client2.on("type", onType2);

		const type = {
			name: "Test type",
			type: "line"
		} satisfies LegacyV2Type<CRU.CREATE>;

		const typeResult = await client1.addType(type);

		const expectedType: LegacyV2Type = {
			...type,
			id: typeResult.id,
			padId: mapData.id,
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

		const client3 = await openClientV2(mapData.id, SocketVersion.V2);
		expect(cloneDeep(client3.types)).toEqual({
			[expectedType.id]: expectedType
		});
	});
});

test("Create type (custom settings)", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	const onType = vi.fn();
	client.on("type", onType);

	await createTemporaryMapV2(client, { createDefaultTypes: false }, async (createMapData, mapData, result) => {
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
		} satisfies LegacyV2Type<CRU.CREATE>;

		const typeResult = await client.addType(type);

		const expectedType: LegacyV2Type = {
			...type,
			id: typeResult.id,
			padId: mapData.id
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
	const client1 = await openClientV2(undefined, SocketVersion.V2);

	const onType = vi.fn();
	client1.on("type", onType);

	await createTemporaryMapV2(client1, { createDefaultTypes: false }, async (createMapData, mapData, result) => {
		const createdType = await client1.addType({
			name: "Test type",
			type: "marker"
		});

		const client2 = await openClientV2(mapData.id, SocketVersion.V2);

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
		} satisfies LegacyV2Type<CRU.UPDATE> & { id: ID };

		const typeResult = await client1.editType(update);

		const expectedType: LegacyV2Type = {
			...update,
			padId: mapData.id,
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

		const client3 = await openClientV2(mapData.id, SocketVersion.V2);
		expect(cloneDeep(client3.types)).toEqual({
			[expectedType.id]: expectedType
		});
	});
});

test("Delete type", async () => {
	const client1 = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client1, { createDefaultTypes: false }, async (createMapData, mapData, result) => {
		const type = await client1.addType({
			name: "Test type",
			type: "marker"
		});

		const client2 = await openClientV2(mapData.id, SocketVersion.V2);

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

		const client3 = await openClientV2(mapData.id, SocketVersion.V2);
		expect(cloneDeep(client3.types)).toEqual({});
	});
});

test("Delete type (existing markers)", async () => {
	const client1 = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client1, { createDefaultTypes: false }, async (createMapData, mapData, result) => {
		const type = await client1.addType({
			name: "Test type",
			type: "marker"
		});

		await client1.addMarker({
			lat: 0,
			lon: 0,
			typeId: type.id
		});

		const client2 = await openClientV2(mapData.id, SocketVersion.V2);

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

		const client3 = await openClientV2(mapData.id, SocketVersion.V2);
		expect(cloneDeep(client3.types)).toEqual({
			[type.id]: type
		});
	});
});

test("Delete type (existing lines)", async () => {
	const client1 = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client1, { createDefaultTypes: false }, async (createMapData, mapData, result) => {
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

		const client2 = await openClientV2(mapData.id, SocketVersion.V2);

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

		const client3 = await openClientV2(mapData.id, SocketVersion.V2);
		expect(cloneDeep(client3.types)).toEqual({
			[type.id]: type
		});
	});
});