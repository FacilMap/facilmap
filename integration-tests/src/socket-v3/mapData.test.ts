import { expect, test, vi } from "vitest";
import { createTemporaryMap, generateTestMapId, getFacilMapUrl, getTemporaryMapData, openClient, openClientStorage } from "../utils";
import { Writable, type MapData, CRU, type FindMapsResult, type PagedResults, SocketVersion } from "facilmap-types";
import { pick } from "lodash-es";

test("Create map (using default values)", async () => {
	const storage = await openClientStorage();

	await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
		const expectedMapData: MapData & { writable: Writable } = {
			...createMapData,
			name: "",
			searchEngines: false,
			description: "",
			clusterMarkers: false,
			legend1: "",
			legend2: "",
			defaultViewId: null,
			defaultView: null,
			writable: Writable.ADMIN
		};

		expect(storage.maps[createMapData.adminId].mapData!.writable).toBe(Writable.ADMIN);
		expect(storage.client.serverError).toBe(undefined);

		expect(mapData).toEqual(expectedMapData);
		expect(storage.maps[createMapData.adminId].mapData).toEqual(expectedMapData);
		expect(await storage.client.getMap(createMapData.adminId)).toEqual(expectedMapData);
	});
});

test("Create map (using custom values)", async () => {
	const storage = await openClientStorage();

	await createTemporaryMap(storage, {
		name: "Test map",
		searchEngines: true,
		description: "Test description",
		clusterMarkers: true,
		legend1: "Legend 1",
		legend2: "Legend 1",
		defaultViewId: null
	}, async (createMapData, mapData) => {
		const expectedMapData: MapData & { writable: Writable } = {
			...createMapData,
			defaultView: null,
			writable: Writable.ADMIN
		};

		expect(storage.maps[createMapData.adminId].mapData!.writable).toBe(Writable.ADMIN);
		expect(storage.client.serverError).toBe(undefined);

		expect(mapData).toEqual(expectedMapData);
		expect(storage.maps[createMapData.adminId].mapData).toEqual(expectedMapData);
		expect(await storage.client.getMap(createMapData.adminId)).toEqual(expectedMapData);
	});
});

test("Create map (ID already taken)", async () => {
	const storage1 = await openClientStorage();
	const storage2 = await openClientStorage();

	await createTemporaryMap(storage1, {}, async (createMapData1) => {
		await expect(async () => {
			await createTemporaryMap(storage2, {
				id: createMapData1.id
			})
		}).rejects.toThrowError("already taken");

		await expect(async () => {
			await createTemporaryMap(storage2, {
				writeId: createMapData1.id
			})
		}).rejects.toThrowError("already taken");

		await expect(async () => {
			await createTemporaryMap(storage2, {
				adminId: createMapData1.id
			})
		}).rejects.toThrowError("already taken");
	});
});

test("Create map (duplicate IDs)", async () => {
	const storage = await openClientStorage();

	const newId = generateTestMapId();

	await expect(async () => {
		await createTemporaryMap(storage, {
			id: newId,
			writeId: newId
		});
	}).rejects.toThrowError("have to be different");

	await expect(async () => {
		await createTemporaryMap(storage, {
			id: newId,
			adminId: newId
		});
	}).rejects.toThrowError("have to be different");

	await expect(async () => {
		await createTemporaryMap(storage, {
			writeId: newId,
			adminId: newId
		});
	}).rejects.toThrowError("have to be different");
});

test("Edit map", async () => {
	const storage = await openClientStorage();

	const onMapData = vi.fn();
	storage.client.on("mapData", onMapData);

	await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
		const update = {
			name: "Test map",
			searchEngines: true,
			description: "Test description",
			clusterMarkers: true,
			legend1: "Legend 1",
			legend2: "Legend 1"
		} satisfies MapData<CRU.UPDATE>;

		const updatedMapData = await storage.client.updateMap(createMapData.adminId, update);

		const expectedMapData: MapData & { writable: Writable } = {
			...createMapData,
			...update,
			defaultViewId: null,
			defaultView: null,
			writable: Writable.ADMIN
		};

		expect(updatedMapData).toEqual(expectedMapData);
		expect(storage.maps[createMapData.adminId].mapData).toEqual(expectedMapData);
		expect(onMapData).toHaveBeenLastCalledWith(expectedMapData);
		expect(await storage.client.getMap(createMapData.adminId)).toEqual(expectedMapData);
	});
});

test("Rename map", async () => {
	const storage = await openClientStorage();

	const onMapSlugRename = vi.fn();
	storage.client.on("mapSlugRename", onMapSlugRename);

	const onMapData = vi.fn();
	storage.client.on("mapData", onMapData);

	await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
		const update = {
			id: generateTestMapId(),
			writeId: generateTestMapId(),
			adminId: generateTestMapId()
		} satisfies MapData<CRU.UPDATE>;

		const updatedMapData = await storage.client.updateMap(createMapData.adminId, update);

		const expectedMapData: MapData & { writable: Writable } = {
			...mapData,
			...update
		};

		expect(updatedMapData).toEqual(expectedMapData);
		expect(storage.maps[createMapData.adminId].mapData).toEqual(expectedMapData);
		expect(onMapData).toHaveBeenLastCalledWith(expectedMapData);
		expect(onMapSlugRename).toHaveBeenCalledWith(createMapData.adminId, expectedMapData.adminId);

		await expect(async () => await storage.client.getMap(createMapData.id)).rejects.toThrow("This map does not exist.");
		await expect(async () => await storage.client.getMap(createMapData.writeId)).rejects.toThrow("This map does not exist.");
		await expect(async () => await storage.client.getMap(createMapData.adminId)).rejects.toThrow("This map does not exist.");

		expect(await storage.client.getMap(update.id)).toEqual(pick(expectedMapData, ["id", "name", "description"]));
		expect(await storage.client.getMap(update.writeId)).toEqual(pick(expectedMapData, ["id", "name", "description"]));
		expect(await storage.client.getMap(update.adminId)).toEqual(pick(expectedMapData, ["id", "name", "description"]));
	});
});

test("Rename map (ID already taken)", async () => {
	const storage1 = await openClientStorage();
	const storage2 = await openClientStorage();

	await createTemporaryMap(storage1, {}, async (createMapData1) => {
		await createTemporaryMap(storage2, {}, async (createMapData2) => {
			await expect(async () => {
				await storage2.client.updateMap(createMapData1.adminId, {
					id: createMapData1.id
				});
			}).rejects.toThrowError("already taken");

			await expect(async () => {
				await storage2.client.updateMap(createMapData1.adminId, {
					writeId: createMapData1.id
				});
			}).rejects.toThrowError("already taken");

			await expect(async () => {
				await storage2.client.updateMap(createMapData1.adminId, {
					adminId: createMapData1.id
				});
			}).rejects.toThrowError("already taken");
		});
	});
});

test("Rename map (duplicate IDs)", async () => {
	const storage = await openClientStorage();

	await createTemporaryMap(storage, {}, async (createMapData) => {
		const newId = generateTestMapId();

		await expect(async () => {
			await storage.client.updateMap(createMapData.adminId, {
				id: newId,
				writeId: newId
			});
		}).rejects.toThrowError("cannot be the same");

		await expect(async () => {
			await storage.client.updateMap(createMapData.adminId, {
				id: newId,
				adminId: newId
			});
		}).rejects.toThrowError("cannot be the same");

		await expect(async () => {
			await storage.client.updateMap(createMapData.adminId, {
				writeId: newId,
				adminId: newId
			});
		}).rejects.toThrowError("cannot be the same");
	});
});

test("Delete map", async () => {
	const storage = await openClientStorage();

	const mapData = getTemporaryMapData(SocketVersion.V3, {});
	await createTemporaryMap(storage, mapData, async () => {
		const result = await storage.client.getMap(mapData.adminId);
		expect(result).toBeTruthy();
	});

	expect(storage.maps[mapData.adminId]).toBeFalsy();
	expect(storage.client.mapSu[mapData.adminId]).toBeFalsy();

	const result = await storage.getMap({ mapId: mapData.id });
	expect(result).toBeNull();
});

test("Open existing map", async () => {
	const storage1 = await openClientStorage();

	await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
		const storage2 = await openClientStorage(createMapData.id);
		expect(storage2.mapData).toEqual({ ...mapData, writeId: undefined, adminId: undefined, writable: Writable.READ });

		const storage3 = await openClientStorage(createMapData.writeId);
		expect(storage3.mapData).toEqual({ ...mapData, adminId: undefined, writable: Writable.WRITE });

		const storage4 = await openClientStorage(createMapData.adminId);
		expect(storage4.mapData).toEqual({ ...mapData, writable: Writable.ADMIN });

		const storage5 = await openClientStorage();
		const onMapData5 = vi.fn();
		storage5.on("mapData", onMapData5);
		const result5 = await storage5.setMapId(createMapData.id);
		expect(result5.mapData![0]).toEqual({ ...mapData, writeId: undefined, adminId: undefined, writable: Writable.READ });
		expect(onMapData5).toBeCalledTimes(1);
		expect(onMapData5).toBeCalledWith({ ...mapData, writeId: undefined, adminId: undefined, writable: Writable.READ });
		expect(storage5.mapData).toEqual({ ...mapData, writeId: undefined, adminId: undefined, writable: Writable.READ });

		const storage6 = await openClientStorage();
		const onMapData6 = vi.fn();
		storage6.on("mapData", onMapData6);
		const result6 = await storage6.setMapId(createMapData.writeId);
		expect(result6.mapData![0]).toEqual({ ...mapData, adminId: undefined, writable: Writable.WRITE });
		expect(onMapData6).toBeCalledTimes(1);
		expect(onMapData6).toBeCalledWith({ ...mapData, adminId: undefined, writable: Writable.WRITE });
		expect(storage6.mapData).toEqual({ ...mapData, adminId: undefined, writable: Writable.WRITE });

		const storage7 = await openClientStorage();
		const onMapData7 = vi.fn();
		storage7.on("mapData", onMapData7);
		const result7 = await storage7.setMapId(createMapData.adminId);
		expect(result7.mapData![0]).toEqual({ ...mapData, writable: Writable.ADMIN });
		expect(onMapData7).toBeCalledTimes(1);
		expect(onMapData7).toBeCalledWith({ ...mapData, writable: Writable.ADMIN });
		expect(storage7.mapData).toEqual({ ...mapData, writable: Writable.ADMIN });
	});
});

test("Open non-existing map", async () => {
	const id = generateTestMapId();

	const client1 = new Client(getFacilMapUrl(), id, { reconnection: false });
	await expect(new Promise<any>((resolve, reject) => {
		client1.on("mapData", resolve);
		client1.on("serverError", reject);
		client1.on("connect_error", reject);
	})).rejects.toThrowError("does not exist");
	expect(client1.serverError?.message).toMatch("does not exist");

	const client2 = await openClientStorage();
	await expect(async () => {
		await client2.setMapId(id);
	}).rejects.toThrowError("does not exist");
	expect(client2.serverError?.message).toMatch("does not exist");
});

test("Find maps", async () => {
	const uniqueId = generateTestMapId();

	const storage = await openClientStorage();
	await createTemporaryMap(storage, {
		name: `Test ${uniqueId} map`,
		searchEngines: true
	}, async (createMapData) => {
		const expectedFound: PagedResults<FindMapsResult> = {
			results: [{ id: createMapData.id, name: `Test ${uniqueId} map`, description: "" }],
			totalLength: 1
		};

		const expectedNotFound: PagedResults<FindMapsResult> = {
			results: [],
			totalLength: 0
		};

		expect(await storage.client.findMaps(`Test ${uniqueId} map`)).toEqual(expectedFound);
		expect(await storage.client.findMaps(`test ${uniqueId} map`)).toEqual(expectedFound);
		expect(await storage.client.findMaps(`Te?t ${uniqueId} map`)).toEqual(expectedFound);
		expect(await storage.client.findMaps(`Te* ${uniqueId} map`)).toEqual(expectedFound);
		expect(await storage.client.findMaps(uniqueId)).toEqual(expectedFound);

		expect(await storage.client.findMaps(`Te ${uniqueId} map`)).toEqual(expectedNotFound);
		expect(await storage.client.findMaps(`Te? ${uniqueId} map`)).toEqual(expectedNotFound);
		expect(await storage.client.findMaps(`Te% ${uniqueId} map`)).toEqual(expectedNotFound);

		await storage.client.updateMap(createMapData.adminId, { searchEngines: false });

		expect(await storage.client.findMaps(`Test ${uniqueId} map`)).toEqual(expectedNotFound);
	});
});