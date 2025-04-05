import { expect, test, vi } from "vitest";
import { createTemporaryMap, openClientStorage, retry } from "../../utils";
import { CRU, type Type } from "facilmap-types";
import { cloneDeep } from "lodash-es";

test("Default types are added", async () => {
	const storage = await openClientStorage();

	const onType = vi.fn();
	storage.client.on("type", onType);

	await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
		const expectedTypes = [
			{
				fields: [
					{ name: "Description", type: "textarea" }
				],
				id: Object.values(storage.maps[mapData.adminId].types)[0].id,
				name: 'Marker',
				type: 'marker',
				idx: 0,
				defaultColour: 'ff0000',
				colourFixed: false,
				defaultSize: 30,
				sizeFixed: false,
				defaultIcon: '',
				iconFixed: false,
				defaultShape: '',
				shapeFixed: false,
				defaultWidth: 4,
				widthFixed: false,
				defaultStroke: '',
				strokeFixed: false,
				defaultMode: '',
				modeFixed: false,
				showInLegend: false,
				mapId: mapData.id
			},
			{
				fields: [
					{ name: "Description", type: "textarea" }
				],
				id: Object.values(storage.maps[mapData.adminId].types)[1].id,
				name: 'Line',
				type: 'line',
				idx: 1,
				defaultColour: '0000ff',
				colourFixed: false,
				defaultSize: 30,
				sizeFixed: false,
				defaultIcon: '',
				iconFixed: false,
				defaultShape: '',
				shapeFixed: false,
				defaultWidth: 4,
				widthFixed: false,
				defaultStroke: '',
				strokeFixed: false,
				defaultMode: '',
				modeFixed: false,
				showInLegend: false,
				mapId: mapData.id
			}
		] satisfies Array<Type>;

		expect(Object.values(storage.maps[mapData.adminId].types)).toEqual(expectedTypes);

		expect(onType).toBeCalledTimes(expectedTypes.length);
		for (const type of expectedTypes) {
			expect(onType).toBeCalledWith(mapData.adminId, type);
		}

		expect(storage.maps[mapData.adminId].types).toEqual(Object.fromEntries(expectedTypes.map((t) => [t.id, t])));
	});
});

test("Default types are not added", async () => {
	const storage = await openClientStorage();

	await createTemporaryMap(storage, { createDefaultTypes: false }, async (createMapData, mapData) => {
		expect(storage.maps[mapData.adminId].types).toEqual({});
	});
});

test("Create type (marker, default settings)", async () => {
	const storage1 = await openClientStorage();

	await createTemporaryMap(storage1, { createDefaultTypes: false }, async (createMapData, mapData) => {
		const storage2 = await openClientStorage(mapData.readId);

		const onType1 = vi.fn();
		storage1.client.on("type", onType1);

		const onType2 = vi.fn();
		storage2.client.on("type", onType2);

		const type = {
			name: "Test type",
			type: "marker"
		} satisfies Type<CRU.CREATE>;

		const typeResult = await storage1.client.createType(mapData.adminId, type);

		const expectedType: Type = {
			...type,
			id: typeResult.id,
			mapId: mapData.id,
			idx: 0,
			defaultColour: "ff0000",
			colourFixed: false,
			defaultSize: 30,
			sizeFixed: false,
			defaultIcon: "",
			iconFixed: false,
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

		expect(onType1).toHaveBeenNthCalledWith(1, mapData.adminId, expectedType);
		expect(cloneDeep(storage1.maps[mapData.adminId].types)).toEqual({
			[expectedType.id]: expectedType
		});

		expect(onType2).toHaveBeenNthCalledWith(1, mapData.readId, expectedType);
		expect(cloneDeep(storage2.maps[mapData.readId].types)).toEqual({
			[expectedType.id]: expectedType
		});

		const storage3 = await openClientStorage(mapData.readId);
		expect(cloneDeep(storage3.maps[mapData.readId].types)).toEqual({
			[expectedType.id]: expectedType
		});
	});
});

test("Create type (line, default settings)", async () => {
	const storage1 = await openClientStorage();

	const onType = vi.fn();
	storage1.client.on("type", onType);

	await createTemporaryMap(storage1, { createDefaultTypes: false }, async (createMapData, mapData) => {
		const storage2 = await openClientStorage(mapData.readId);

		const onType1 = vi.fn();
		storage1.client.on("type", onType1);

		const onType2 = vi.fn();
		storage2.client.on("type", onType2);

		const type = {
			name: "Test type",
			type: "line"
		} satisfies Type<CRU.CREATE>;

		const typeResult = await storage1.client.createType(mapData.adminId, type);

		const expectedType: Type = {
			...type,
			id: typeResult.id,
			mapId: mapData.id,
			idx: 0,
			defaultColour: "0000ff",
			colourFixed: false,
			defaultSize: 30,
			sizeFixed: false,
			defaultIcon: "",
			iconFixed: false,
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

		expect(onType1).toHaveBeenNthCalledWith(1, mapData.adminId, expectedType);
		expect(cloneDeep(storage1.maps[mapData.adminId].types)).toEqual({
			[expectedType.id]: expectedType
		});

		expect(onType2).toHaveBeenNthCalledWith(1, mapData.readId, expectedType);
		expect(cloneDeep(storage2.maps[mapData.readId].types)).toEqual({
			[expectedType.id]: expectedType
		});

		const storage3 = await openClientStorage(mapData.readId);
		expect(cloneDeep(storage3.maps[mapData.readId].types)).toEqual({
			[expectedType.id]: expectedType
		});
	});
});

test("Create type (custom settings)", async () => {
	const storage = await openClientStorage();

	const onType = vi.fn();
	storage.client.on("type", onType);

	await createTemporaryMap(storage, { createDefaultTypes: false }, async (createMapData, mapData) => {
		const onType = vi.fn();
		storage.client.on("type", onType);

		const type = {
			name: "Test type",
			type: "marker",
			idx: 4,
			defaultColour: "00ff00",
			colourFixed: true,
			defaultSize: 35,
			sizeFixed: true,
			defaultIcon: "a",
			iconFixed: true,
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

		const typeResult = await storage.client.createType(mapData.adminId, type);

		const expectedType: Type = {
			...type,
			id: typeResult.id,
			mapId: mapData.id
		};

		expect(typeResult).toEqual(expectedType);

		await retry(async () => {
			expect(onType).toBeCalledTimes(1);
		});

		expect(onType).toHaveBeenNthCalledWith(1, mapData.adminId, expectedType);
		expect(cloneDeep(storage.maps[mapData.adminId].types)).toEqual({
			[expectedType.id]: expectedType
		});
	});
});

test("Update type", async () => {
	const storage1 = await openClientStorage();

	const onType = vi.fn();
	storage1.client.on("type", onType);

	await createTemporaryMap(storage1, { createDefaultTypes: false }, async (createMapData, mapData) => {
		const createdType = await storage1.client.createType(mapData.adminId, {
			name: "Test type",
			type: "marker"
		});

		const storage2 = await openClientStorage(mapData.readId);

		const onType1 = vi.fn();
		storage1.client.on("type", onType1);

		const onType2 = vi.fn();
		storage2.client.on("type", onType2);

		const update = {
			name: "Test type 2",
			idx: 4,
			defaultColour: "00ff00",
			colourFixed: true,
			defaultSize: 35,
			sizeFixed: true,
			defaultIcon: "a",
			iconFixed: true,
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

		const typeResult = await storage1.client.updateType(mapData.adminId, createdType.id, update);

		const expectedType: Type = {
			...update,
			id: createdType.id,
			mapId: mapData.id,
			type: "marker"
		};

		expect(typeResult).toEqual(expectedType);

		await retry(async () => {
			expect(onType1).toBeCalledTimes(1);
			expect(onType2).toBeCalledTimes(1);
		});

		expect(onType1).toHaveBeenNthCalledWith(1, mapData.adminId, expectedType);
		expect(cloneDeep(storage1.maps[mapData.adminId].types)).toEqual({
			[expectedType.id]: expectedType
		});

		expect(onType2).toHaveBeenNthCalledWith(1, mapData.readId, expectedType);
		expect(cloneDeep(storage2.maps[mapData.readId].types)).toEqual({
			[expectedType.id]: expectedType
		});

		const storage3 = await openClientStorage(mapData.readId);
		expect(cloneDeep(storage3.maps[mapData.readId].types)).toEqual({
			[expectedType.id]: expectedType
		});
	});
});

test("Delete type", async () => {
	const storage1 = await openClientStorage();

	await createTemporaryMap(storage1, { createDefaultTypes: false }, async (createMapData, mapData) => {
		const type = await storage1.client.createType(mapData.adminId, {
			name: "Test type",
			type: "marker"
		});

		const storage2 = await openClientStorage(mapData.readId);

		const onDeleteType1 = vi.fn();
		storage1.client.on("deleteType", onDeleteType1);

		const onDeleteType2 = vi.fn();
		storage2.client.on("deleteType", onDeleteType2);

		await storage1.client.deleteType(mapData.adminId, type.id);

		await retry(async () => {
			expect(onDeleteType1).toBeCalledTimes(1);
			expect(onDeleteType2).toBeCalledTimes(1);
		});

		expect(onDeleteType1).toHaveBeenNthCalledWith(1, mapData.adminId, { id: type.id });
		expect(cloneDeep(storage1.maps[mapData.adminId].types)).toEqual({});

		expect(onDeleteType2).toHaveBeenNthCalledWith(1, mapData.readId, { id: type.id });
		expect(cloneDeep(storage2.maps[mapData.readId].types)).toEqual({});

		const storage3 = await openClientStorage(mapData.readId);
		expect(cloneDeep(storage3.maps[mapData.readId].types)).toEqual({});
	});
});

test("Delete type (existing markers)", async () => {
	const storage1 = await openClientStorage();

	await createTemporaryMap(storage1, { createDefaultTypes: false }, async (createMapData, mapData) => {
		const type = await storage1.client.createType(mapData.adminId, {
			name: "Test type",
			type: "marker"
		});

		await storage1.client.createMarker(mapData.adminId, {
			lat: 0,
			lon: 0,
			typeId: type.id
		});

		const storage2 = await openClientStorage(mapData.readId);

		const onDeleteType1 = vi.fn();
		storage1.client.on("deleteType", onDeleteType1);

		const onDeleteType2 = vi.fn();
		storage2.client.on("deleteType", onDeleteType2);

		await expect(async () => {
			await storage1.client.deleteType(mapData.adminId, type.id);
		}).rejects.toThrowError("This type is in use.");

		expect(onDeleteType1).toBeCalledTimes(0);
		expect(onDeleteType2).toBeCalledTimes(0);
		expect(cloneDeep(storage1.maps[mapData.adminId].types)).toEqual({
			[type.id]: type
		});
		expect(cloneDeep(storage2.maps[mapData.readId].types)).toEqual({
			[type.id]: type
		});

		const storage3 = await openClientStorage(mapData.readId);
		expect(cloneDeep(storage3.maps[mapData.readId].types)).toEqual({
			[type.id]: type
		});
	});
});

test("Delete type (existing lines)", async () => {
	const storage1 = await openClientStorage();

	await createTemporaryMap(storage1, { createDefaultTypes: false }, async (createMapData, mapData) => {
		const type = await storage1.client.createType(mapData.adminId, {
			name: "Test type",
			type: "line"
		});

		await storage1.client.createLine(mapData.adminId, {
			routePoints: [
				{ lat: 0, lon: 0 },
				{ lat: 1, lon: 1 }
			],
			typeId: type.id
		});

		const storage2 = await openClientStorage(mapData.readId);

		const onDeleteType1 = vi.fn();
		storage1.client.on("deleteType", onDeleteType1);

		const onDeleteType2 = vi.fn();
		storage2.client.on("deleteType", onDeleteType2);

		await expect(async () => {
			await storage1.client.deleteType(mapData.adminId, type.id);
		}).rejects.toThrowError("This type is in use.");

		expect(onDeleteType1).toBeCalledTimes(0);
		expect(onDeleteType2).toBeCalledTimes(0);
		expect(cloneDeep(storage1.maps[mapData.adminId].types)).toEqual({
			[type.id]: type
		});
		expect(cloneDeep(storage2.maps[mapData.readId].types)).toEqual({
			[type.id]: type
		});

		const storage3 = await openClientStorage(mapData.readId);
		expect(cloneDeep(storage3.maps[mapData.readId].types)).toEqual({
			[type.id]: type
		});
	});
});