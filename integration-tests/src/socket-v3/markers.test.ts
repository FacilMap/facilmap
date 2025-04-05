import { expect, test, vi } from "vitest";
import { createTemporaryMap, openClientStorage, retry } from "../utils";
import { CRU, type Marker, type FindOnMapMarker, SocketVersion } from "facilmap-types";
import { cloneDeep } from "lodash-es";

test("Create marker (using default values)", async () => {
	// storage1: Creates the marker and has it in its bbox
	// storage2: Has the marker in its bbox
	// storage3: Does not have the marker in its bbox

	const storage1 = await openClientStorage(undefined, SocketVersion.V3);

	await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
		const storage2 = await openClientStorage(mapData.readId);
		const storage3 = await openClientStorage(mapData.readId);

		const onMarker1 = vi.fn();
		storage1.client.on("marker", onMarker1);
		const onMarker2 = vi.fn();
		storage2.client.on("marker", onMarker2);
		const onMarker3 = vi.fn();
		storage3.client.on("marker", onMarker3);

		const markerType = Object.values(storage1.maps[mapData.adminId].types).find((t) => t.type === "marker")!;

		await storage1.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await storage2.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await storage3.client.setBbox({ top: 5, bottom: 0, left: 0, right: 5, zoom: 1 });

		const marker = await storage1.client.createMarker(mapData.adminId, {
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			ele: null
		});

		const expectedMarker = {
			id: marker.id,
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			mapId: mapData.id,
			name: "",
			colour: "ff0000",
			size: 30,
			icon: "",
			shape: "",
			data: {},
			ele: null
		} satisfies Marker;

		expect(marker).toEqual(expectedMarker);

		await retry(() => {
			expect(onMarker1).toHaveBeenCalledTimes(1);
			expect(onMarker2).toHaveBeenCalledTimes(1);
			expect(onMarker3).toHaveBeenCalledTimes(0);
		});

		expect(onMarker1).toHaveBeenCalledWith(mapData.adminId, expectedMarker);
		expect(onMarker2).toHaveBeenCalledWith(mapData.readId, expectedMarker);

		const expectedMarkerRecord = { [expectedMarker.id]: expectedMarker };
		expect(cloneDeep(storage1.maps[mapData.adminId].markers)).toEqual(expectedMarkerRecord);
		expect(cloneDeep(storage2.maps[mapData.readId].markers)).toEqual(expectedMarkerRecord);
		expect(cloneDeep(storage3.maps[mapData.readId].markers)).toEqual({});
	});
});

test("Create marker (using custom values)", async () => {
	const storage = await openClientStorage(undefined, SocketVersion.V3);

	await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
		const markerType = Object.values(storage.maps[mapData.adminId].types).find((t) => t.type === "marker")!;

		const data: Marker<CRU.CREATE> = {
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			name: "Test marker",
			colour: "0000ff",
			size: 40,
			icon: "icon",
			shape: "shape",
			data: {
				test: "value"
			},
			ele: 200
		};

		const marker = await storage.client.createMarker(mapData.adminId, data);

		const expectedMarker = {
			id: marker.id,
			mapId: mapData.id,
			...data
		};

		expect(marker).toEqual(expectedMarker);
	});
});

test("Edit marker", async () => {
	// storage1: Creates the marker and has it in its bbox
	// storage2: Has the marker in its bbox
	// storage3: Does not have the marker in its bbox

	const storage1 = await openClientStorage(undefined, SocketVersion.V3);

	await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
		const storage2 = await openClientStorage(mapData.readId);
		const storage3 = await openClientStorage(mapData.readId);

		const markerType = Object.values(storage1.maps[mapData.adminId].types).find((t) => t.type === "marker")!;

		const createdMarker = await storage1.client.createMarker(mapData.adminId, {
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			ele: null
		});

		const secondType = await storage1.client.createType(mapData.adminId, {
			type: "marker",
			name: "Second type"
		});

		await storage1.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await storage2.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await storage3.client.setBbox({ top: 5, bottom: 0, left: 0, right: 5, zoom: 1 });

		const onMarker1 = vi.fn();
		storage1.client.on("marker", onMarker1);
		const onMarker2 = vi.fn();
		storage2.client.on("marker", onMarker2);
		const onMarker3 = vi.fn();
		storage3.client.on("marker", onMarker3);

		const newData: Marker<CRU.UPDATE> = {
			lat: 10,
			lon: 10,
			typeId: secondType.id,
			name: "Test marker",
			colour: "0000ff",
			size: 40,
			icon: "icon",
			shape: "shape",
			data: {
				test: "value"
			},
			ele: 200
		};
		const marker = await storage1.client.updateMarker(mapData.adminId, createdMarker.id, newData);

		const expectedMarker = {
			id: createdMarker.id,
			mapId: mapData.id,
			...newData
		};

		expect(marker).toEqual(expectedMarker);

		await retry(() => {
			expect(onMarker1).toHaveBeenCalledTimes(1);
			expect(onMarker2).toHaveBeenCalledTimes(1);
			expect(onMarker3).toHaveBeenCalledTimes(0);
		});

		expect(onMarker1).toHaveBeenCalledWith(mapData.adminId, expectedMarker);
		expect(onMarker2).toHaveBeenCalledWith(mapData.readId, expectedMarker);

		const expectedMarkerRecord = { [createdMarker.id]: expectedMarker };
		expect(cloneDeep(storage1.maps[mapData.adminId].markers)).toEqual(expectedMarkerRecord);
		expect(cloneDeep(storage2.maps[mapData.readId].markers)).toEqual(expectedMarkerRecord);
		expect(cloneDeep(storage3.maps[mapData.readId].markers)).toEqual({});
	});
});

test("Delete marker", async () => {
	// storage1: Creates the marker and has it in its bbox
	// storage2: Has the marker in its bbox
	// storage3: Does not have the marker in its bbox

	const storage1 = await openClientStorage(undefined, SocketVersion.V3);

	await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
		const storage2 = await openClientStorage(mapData.readId);
		const storage3 = await openClientStorage(mapData.readId);

		const markerType = Object.values(storage1.maps[mapData.adminId].types).find((t) => t.type === "marker")!;

		await storage1.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await storage2.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await storage3.client.setBbox({ top: 5, bottom: 0, left: 0, right: 5, zoom: 1 });

		const createdMarker = await storage1.client.createMarker(mapData.adminId, {
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			ele: null
		});

		const onDeleteMarker1 = vi.fn();
		storage1.client.on("deleteMarker", onDeleteMarker1);
		const onDeleteMarker2 = vi.fn();
		storage2.client.on("deleteMarker", onDeleteMarker2);
		const onDeleteMarker3 = vi.fn();
		storage3.client.on("deleteMarker", onDeleteMarker3);

		await storage1.client.deleteMarker(mapData.adminId, createdMarker.id);

		await retry(() => {
			expect(onDeleteMarker1).toHaveBeenCalledTimes(1);
			expect(onDeleteMarker2).toHaveBeenCalledTimes(1);
			expect(onDeleteMarker3).toHaveBeenCalledTimes(1);
		});

		expect(onDeleteMarker1).toHaveBeenCalledWith(mapData.adminId, { id: createdMarker.id });
		expect(onDeleteMarker2).toHaveBeenCalledWith(mapData.readId, { id: createdMarker.id });
		expect(onDeleteMarker3).toHaveBeenCalledWith(mapData.readId, { id: createdMarker.id });

		const expectedMarkerRecord = { };
		expect(cloneDeep(storage1.maps[mapData.adminId].markers)).toEqual(expectedMarkerRecord);
		expect(cloneDeep(storage2.maps[mapData.readId].markers)).toEqual(expectedMarkerRecord);
		expect(cloneDeep(storage3.maps[mapData.readId].markers)).toEqual({});
	});
});

test("Get marker", async () => {
	const storage1 = await openClientStorage(undefined, SocketVersion.V3);

	await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
		const storage2 = await openClientStorage(mapData.readId);

		const markerType = Object.values(storage1.maps[mapData.adminId].types).find((t) => t.type === "marker")!;

		const marker = await storage1.client.createMarker(mapData.adminId, {
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			ele: null
		});

		const expectedMarker = {
			id: marker.id,
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			mapId: mapData.id,
			name: "",
			colour: "ff0000",
			size: 30,
			icon: "",
			shape: "",
			data: {},
			ele: null
		} satisfies Marker;

		expect(await storage2.client.getMarker(mapData.readId, marker.id)).toEqual(expectedMarker);
	});
});

test("Find marker", async () => {
	const storage1 = await openClientStorage(undefined, SocketVersion.V3);

	await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
		const storage2 = await openClientStorage(mapData.readId);

		const markerType = Object.values(storage1.maps[mapData.adminId].types).find((t) => t.type === "marker")!;

		const marker = await storage1.client.createMarker(mapData.adminId, {
			name: "Marker test",
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			icon: "a",
			ele: null
		});

		const expectedResult: FindOnMapMarker = {
			id: marker.id,
			kind: "marker",
			similarity: 1,
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			name: "Marker test",
			icon: "a"
		};

		expect(await storage2.client.findOnMap(mapData.readId, "Test")).toEqual([{ ...expectedResult, similarity: 0.3333333333333333 }]);
		expect(await storage2.client.findOnMap(mapData.readId, "T_st")).toEqual([{ ...expectedResult, similarity: 0.16666666666666666 }]);
		expect(await storage2.client.findOnMap(mapData.readId, "M%r")).toEqual([{ ...expectedResult, similarity: 0 }]);
		expect(await storage2.client.findOnMap(mapData.readId, "Bla")).toEqual([]);
	});
});

test("Try to create marker with line type", async () => {
	const storage = await openClientStorage(undefined, SocketVersion.V3);

	await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
		const lineType = Object.values(storage.maps[mapData.adminId].types).find((t) => t.type === "line")!;

		await expect(async () => {
			await storage.client.createMarker(mapData.adminId, {
				lat: 10,
				lon: 10,
				typeId: lineType.id
			});
		}).rejects.toThrowError("Cannot use line type for marker");

		const storage3 = await openClientStorage(createMapData.adminId);
		await storage3.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		expect(cloneDeep(storage3.maps[mapData.adminId].markers)).toEqual({});
	});
});

test("Try to update marker with line type", async () => {
	const storage = await openClientStorage(undefined, SocketVersion.V3);

	await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
		const markerType = Object.values(storage.maps[mapData.adminId].types).find((t) => t.type === "marker")!;
		const lineType = Object.values(storage.maps[mapData.adminId].types).find((t) => t.type === "line")!;

		const marker = await storage.client.createMarker(mapData.adminId, {
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			ele: null
		});

		await expect(async () => {
			await storage.client.updateMarker(mapData.adminId, marker.id, {
				typeId: lineType.id
			});
		}).rejects.toThrowError("Cannot use line type for marker");

		const storage3 = await openClientStorage(createMapData.adminId);
		await storage3.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		expect(cloneDeep(storage3.maps[mapData.adminId].markers)).toEqual({
			[marker.id]: marker
		});
	});
});

test("Try to create marker with marker type from other map", async () => {
	const storage1 = await openClientStorage(undefined, SocketVersion.V3);
	const storage2 = await openClientStorage(undefined, SocketVersion.V3);

	await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
		await createTemporaryMap(storage2, {}, async (createMapData2, mapData2) => {
			const markerType2 = Object.values(storage2.maps[mapData2.adminId].types).find((t) => t.type === "marker")!;

			await expect(async () => {
				await storage1.client.createMarker(mapData.adminId, {
					lat: 10,
					lon: 10,
					typeId: markerType2.id
				});
			}).rejects.toThrowError("could not be found");

			const storage3 = await openClientStorage(createMapData.adminId);
			await storage3.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
			expect(cloneDeep(storage3.maps[createMapData.adminId].markers)).toEqual({});
		});
	});
});

test("Try to update marker with marker type from other map", async () => {
	const storage1 = await openClientStorage(undefined, SocketVersion.V3);
	const storage2 = await openClientStorage(undefined, SocketVersion.V3);

	await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
		await createTemporaryMap(storage2, {}, async (createMapData2, mapData2, subscription2) => {
			const markerType1 = Object.values(storage1.maps[mapData.adminId].types).find((t) => t.type === "marker")!;
			const markerType2 = Object.values(storage2.maps[mapData2.adminId].types).find((t) => t.type === "marker")!;

			const marker = await storage1.client.createMarker(mapData.adminId, {
				lat: 10,
				lon: 10,
				typeId: markerType1.id,
				ele: null
			});

			await expect(async () => {
				await storage1.client.updateMarker(mapData.adminId, marker.id, {
					typeId: markerType2.id
				});
			}).rejects.toThrowError("could not be found");

			const storage3 = await openClientStorage(createMapData.adminId);
			await storage3.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
			expect(cloneDeep(storage3.maps[createMapData.adminId].markers)).toEqual({
				[marker.id]: marker
			});
		});
	});
});
