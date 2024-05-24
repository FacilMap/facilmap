import { expect, test, vi } from "vitest";
import { createTemporaryMap, generateTestMapId, getFacilMapUrl, getTemporaryMapData, openClient } from "../utils";
import { Writable, type MapData, CRU, type FindMapsResult, type PagedResults, SocketVersion } from "facilmap-types";
import { pick } from "lodash-es";
import Client from "facilmap-client";

test("Create map (using default values)", async () => {
	const client = await openClient();

	const onMapData = vi.fn();
	client.on("mapData", onMapData);

	await createTemporaryMap(client, {}, async (createMapData, mapData) => {
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

		expect(client.mapId).toBe(createMapData.adminId);
		expect(client.readonly).toBe(false);
		expect(client.writable).toBe(Writable.ADMIN);
		expect(client.serverError).toBe(undefined);

		expect(mapData).toEqual(expectedMapData);
		expect(client.mapData).toEqual(expectedMapData);
		expect(onMapData).toBeCalledTimes(1);
		expect(onMapData).toHaveBeenCalledWith(expectedMapData);
		expect(await client.getMap({ mapId: createMapData.id })).toEqual(pick(expectedMapData, ["id", "name", "description"]));
	});
});

test("Create map (using custom values)", async () => {
	const client = await openClient();

	const onMapData = vi.fn();
	client.on("mapData", onMapData);

	await createTemporaryMap(client, {
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

		expect(client.mapId).toBe(createMapData.adminId);
		expect(client.readonly).toBe(false);
		expect(client.writable).toBe(Writable.ADMIN);
		expect(client.serverError).toBe(undefined);

		expect(mapData).toEqual(expectedMapData);
		expect(client.mapData).toEqual(expectedMapData);
		expect(onMapData).toBeCalledTimes(1);
		expect(onMapData).toHaveBeenCalledWith(expectedMapData);
		expect(await client.getMap({ mapId: createMapData.id })).toEqual(pick(expectedMapData, ["id", "name", "description"]));
	});
});

test("Create map (ID already taken)", async () => {
	const client1 = await openClient();
	const client2 = await openClient();

	await createTemporaryMap(client1, {}, async (createMapData1) => {
		await expect(async () => {
			await createTemporaryMap(client2, {
				id: createMapData1.id
			})
		}).rejects.toThrowError("already taken");

		await expect(async () => {
			await createTemporaryMap(client2, {
				writeId: createMapData1.id
			})
		}).rejects.toThrowError("already taken");

		await expect(async () => {
			await createTemporaryMap(client2, {
				adminId: createMapData1.id
			})
		}).rejects.toThrowError("already taken");
	});
});

test("Create map (duplicate IDs)", async () => {
	const client = await openClient();

	const newId = generateTestMapId();

	await expect(async () => {
		await createTemporaryMap(client, {
			id: newId,
			writeId: newId
		});
	}).rejects.toThrowError("have to be different");

	await expect(async () => {
		await createTemporaryMap(client, {
			id: newId,
			adminId: newId
		});
	}).rejects.toThrowError("have to be different");

	await expect(async () => {
		await createTemporaryMap(client, {
			writeId: newId,
			adminId: newId
		});
	}).rejects.toThrowError("have to be different");
});

test("Edit map", async () => {
	const client = await openClient();

	const onMapData = vi.fn();
	client.on("mapData", onMapData);

	await createTemporaryMap(client, {}, async (createMapData, mapData) => {
		const update = {
			name: "Test map",
			searchEngines: true,
			description: "Test description",
			clusterMarkers: true,
			legend1: "Legend 1",
			legend2: "Legend 1"
		} satisfies MapData<CRU.UPDATE>;

		const updatedMapData = await client.editMap(update);

		const expectedMapData: MapData & { writable: Writable } = {
			...createMapData,
			...update,
			defaultViewId: null,
			defaultView: null,
			writable: Writable.ADMIN
		};

		expect(updatedMapData).toEqual(expectedMapData);
		expect(client.mapData).toEqual(expectedMapData);
		expect(onMapData).toHaveBeenLastCalledWith(expectedMapData);
		expect(await client.getMap({ mapId: createMapData.id })).toEqual(pick(expectedMapData, ["id", "name", "description"]));
	});
});

test("Rename map", async () => {
	const client = await openClient();

	const onMapData = vi.fn();
	client.on("mapData", onMapData);

	await createTemporaryMap(client, {}, async (createMapData, mapData) => {
		const update = {
			id: generateTestMapId(),
			writeId: generateTestMapId(),
			adminId: generateTestMapId()
		} satisfies MapData<CRU.UPDATE>;

		const updatedMapData = await client.editMap(update);

		const expectedMapData: MapData & { writable: Writable } = {
			...mapData,
			...update
		};

		expect(updatedMapData).toEqual(expectedMapData);
		expect(client.mapData).toEqual(expectedMapData);
		expect(onMapData).toHaveBeenLastCalledWith(expectedMapData);

		expect(await client.getMap({ mapId: createMapData.id })).toBeNull();
		expect(await client.getMap({ mapId: createMapData.writeId })).toBeNull();
		expect(await client.getMap({ mapId: createMapData.adminId })).toBeNull();

		expect(await client.getMap({ mapId: update.id })).toEqual(pick(expectedMapData, ["id", "name", "description"]));
		expect(await client.getMap({ mapId: update.writeId })).toEqual(pick(expectedMapData, ["id", "name", "description"]));
		expect(await client.getMap({ mapId: update.adminId })).toEqual(pick(expectedMapData, ["id", "name", "description"]));
	});
});

test("Rename map (ID already taken)", async () => {
	const client1 = await openClient();
	const client2 = await openClient();

	await createTemporaryMap(client1, {}, async (createMapData1) => {
		await createTemporaryMap(client2, {}, async (createMapData2) => {
			await expect(async () => {
				await client2.editMap({
					id: createMapData1.id
				});
			}).rejects.toThrowError("already taken");

			await expect(async () => {
				await client2.editMap({
					writeId: createMapData1.id
				});
			}).rejects.toThrowError("already taken");

			await expect(async () => {
				await client2.editMap({
					adminId: createMapData1.id
				});
			}).rejects.toThrowError("already taken");
		});
	});
});

test("Rename map (duplicate IDs)", async () => {
	const client = await openClient();

	await createTemporaryMap(client, {}, async () => {
		const newId = generateTestMapId();

		await expect(async () => {
			await client.editMap({
				id: newId,
				writeId: newId
			});
		}).rejects.toThrowError("cannot be the same");

		await expect(async () => {
			await client.editMap({
				id: newId,
				adminId: newId
			});
		}).rejects.toThrowError("cannot be the same");

		await expect(async () => {
			await client.editMap({
				writeId: newId,
				adminId: newId
			});
		}).rejects.toThrowError("cannot be the same");
	});
});

test("Delete map", async () => {
	const client = await openClient();

	const mapData = getTemporaryMapData(SocketVersion.V3, {});
	await createTemporaryMap(client, mapData, async () => {
		expect(client.deleted).toBe(false);

		const result = await client.getMap({ mapId: mapData.id });
		expect(result).toBeTruthy();
	});

	expect(client.deleted).toBe(true);

	const result = await client.getMap({ mapId: mapData.id });
	expect(result).toBeNull();
});

test("Open existing map", async () => {
	const client1 = await openClient();

	await createTemporaryMap(client1, {}, async (createMapData, mapData) => {
		const client2 = await openClient(createMapData.id);
		expect(client2.mapData).toEqual({ ...mapData, writeId: undefined, adminId: undefined, writable: Writable.READ });

		const client3 = await openClient(createMapData.writeId);
		expect(client3.mapData).toEqual({ ...mapData, adminId: undefined, writable: Writable.WRITE });

		const client4 = await openClient(createMapData.adminId);
		expect(client4.mapData).toEqual({ ...mapData, writable: Writable.ADMIN });

		const client5 = await openClient();
		const onMapData5 = vi.fn();
		client5.on("mapData", onMapData5);
		const result5 = await client5.setMapId(createMapData.id);
		expect(result5.mapData![0]).toEqual({ ...mapData, writeId: undefined, adminId: undefined, writable: Writable.READ });
		expect(onMapData5).toBeCalledTimes(1);
		expect(onMapData5).toBeCalledWith({ ...mapData, writeId: undefined, adminId: undefined, writable: Writable.READ });
		expect(client5.mapData).toEqual({ ...mapData, writeId: undefined, adminId: undefined, writable: Writable.READ });

		const client6 = await openClient();
		const onMapData6 = vi.fn();
		client6.on("mapData", onMapData6);
		const result6 = await client6.setMapId(createMapData.writeId);
		expect(result6.mapData![0]).toEqual({ ...mapData, adminId: undefined, writable: Writable.WRITE });
		expect(onMapData6).toBeCalledTimes(1);
		expect(onMapData6).toBeCalledWith({ ...mapData, adminId: undefined, writable: Writable.WRITE });
		expect(client6.mapData).toEqual({ ...mapData, adminId: undefined, writable: Writable.WRITE });

		const client7 = await openClient();
		const onMapData7 = vi.fn();
		client7.on("mapData", onMapData7);
		const result7 = await client7.setMapId(createMapData.adminId);
		expect(result7.mapData![0]).toEqual({ ...mapData, writable: Writable.ADMIN });
		expect(onMapData7).toBeCalledTimes(1);
		expect(onMapData7).toBeCalledWith({ ...mapData, writable: Writable.ADMIN });
		expect(client7.mapData).toEqual({ ...mapData, writable: Writable.ADMIN });
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

	const client2 = await openClient();
	await expect(async () => {
		await client2.setMapId(id);
	}).rejects.toThrowError("does not exist");
	expect(client2.serverError?.message).toMatch("does not exist");
});

test("Find maps", async () => {
	const uniqueId = generateTestMapId();

	const client = await openClient();
	await createTemporaryMap(client, {
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

		expect(await client.findMaps({ query: `Test ${uniqueId} map` })).toEqual(expectedFound);
		expect(await client.findMaps({ query: `test ${uniqueId} map` })).toEqual(expectedFound);
		expect(await client.findMaps({ query: `Te?t ${uniqueId} map` })).toEqual(expectedFound);
		expect(await client.findMaps({ query: `Te* ${uniqueId} map` })).toEqual(expectedFound);
		expect(await client.findMaps({ query: uniqueId })).toEqual(expectedFound);

		expect(await client.findMaps({ query: `Te ${uniqueId} map` })).toEqual(expectedNotFound);
		expect(await client.findMaps({ query: `Te? ${uniqueId} map` })).toEqual(expectedNotFound);
		expect(await client.findMaps({ query: `Te% ${uniqueId} map` })).toEqual(expectedNotFound);

		await client.editMap({ searchEngines: false });

		expect(await client.findMaps({ query: `Test ${uniqueId} map` })).toEqual(expectedNotFound);
	});
});