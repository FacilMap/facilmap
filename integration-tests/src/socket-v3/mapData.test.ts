import { describe, expect, test, vi } from "vitest";
import { createTemporaryMap, generateTestMapSlug, getRestClient, getTemporaryMapData, openClient, openClientStorage, retry } from "../utils";
import { Writable, type MapData, CRU, type FindMapsResult, type PagedResults, SocketVersion, type MapDataWithWritable, type DeepReadonly, ApiVersion } from "facilmap-types";
import { SubscriptionStateType } from "facilmap-client/src/socket-client-subscription";
import { MapSubscriptionStateType, type MapSubscriptionState } from "facilmap-client";
import { getMapDataWithWritable } from "facilmap-utils";

describe.for([
	{ label: "Socket API", useSocket: true },
	{ label: "REST API", useSocket: false }
])("Map data tests ($label)", ({ useSocket }) => {

	const restClient = useSocket ? undefined : getRestClient(ApiVersion.V3);

	const defaultMapProperties = {
		name: "",
		searchEngines: false,
		description: "",
		clusterMarkers: false,
		legend1: "",
		legend2: "",
		defaultViewId: null,
		defaultView: null,
	} satisfies Partial<MapData>;

	const customMapProperties = {
		name: "Test map",
		searchEngines: true,
		description: "Test description",
		clusterMarkers: true,
		legend1: "Legend 1",
		legend2: "Legend 1",
		defaultViewId: null
	} satisfies Partial<MapData<CRU.CREATE>>;

	test("Create map (using default values)", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);
		const createMapData = getTemporaryMapData(useSocket ? SocketVersion.V3 : ApiVersion.V3, {});

		const data = await (restClient ?? storage.client).createMapUnstreamed(createMapData);

		try {
			const expectedMapData: MapDataWithWritable = {
				...createMapData,
				id: data.mapData.id,
				writable: Writable.ADMIN,
				...defaultMapProperties
			};

			expect(mapData).toEqual(expectedMapData);

			if (useSocket) {
				expect(storage.client.mapSubscriptions[mapData.adminId].state.type).toBe(SubscriptionStateType.SUBSCRIBED);
				expect(storage.maps[createMapData.adminId].mapData).toEqual(expectedMapData);
			}

			expect(await (restClient ?? storage.client).getMap(createMapData.adminId)).toEqual(expectedMapData);
		} finally {
			await (restClient ?? storage.client).deleteMap(createMapData.adminId);
		}
	});

	test("Create map (using custom values)", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);

		await createTemporaryMap(restClient ?? storage, customMapProperties, async (createMapData, mapData) => {
			const expectedMapData: MapDataWithWritable = {
				...createMapData,
				id: mapData.id,
				defaultView: null,
				writable: Writable.ADMIN
			};

			expect(mapData).toEqual(expectedMapData);

			if (useSocket) {
				expect(storage.client.mapSubscriptions[mapData.adminId].state.type).toBe(SubscriptionStateType.SUBSCRIBED);
				expect(storage.maps[createMapData.adminId].mapData).toEqual(expectedMapData);
			}

			expect(await (restClient ?? storage.client).getMap(createMapData.adminId)).toEqual(expectedMapData);
		});
	});

	test("Create map (ID already taken)", async () => {
		const storage1 = await openClientStorage(undefined, SocketVersion.V3);
		const storage2 = await openClientStorage(undefined, SocketVersion.V3);

		await createTemporaryMap(restClient ?? storage1, {}, async (createMapData1) => {
			await expect(async () => {
				await createTemporaryMap(restClient ?? storage2, {
					readId: createMapData1.readId
				})
			}).rejects.toThrowError("already taken");

			await expect(async () => {
				await createTemporaryMap(restClient ?? storage2, {
					writeId: createMapData1.readId
				})
			}).rejects.toThrowError("already taken");

			await expect(async () => {
				await createTemporaryMap(restClient ?? storage2, {
					adminId: createMapData1.readId
				})
			}).rejects.toThrowError("already taken");
		});
	});

	test("Create map (duplicate IDs)", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);

		// Use different IDs for each test to avoid duplicate subscription errors
		const newId1 = generateTestMapSlug();
		const newId2 = generateTestMapSlug();
		const newId3 = generateTestMapSlug();

		await expect(async () => {
			await createTemporaryMap(restClient ?? storage, {
				readId: newId1,
				writeId: newId1
			});
		}).rejects.toThrowError("have to be different");

		await expect(async () => {
			await createTemporaryMap(restClient ?? storage, {
				readId: newId2,
				adminId: newId2
			});
		}).rejects.toThrowError("have to be different");

		await expect(async () => {
			await createTemporaryMap(restClient ?? storage, {
				writeId: newId3,
				adminId: newId3
			});
		}).rejects.toThrowError("have to be different");
	});

	test("Edit map", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);

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

			const updatedMapData = await (restClient ?? storage.client).updateMap(createMapData.adminId, update);

			const expectedMapData: MapDataWithWritable = {
				...createMapData,
				...update,
				id: mapData.id,
				defaultViewId: null,
				defaultView: null,
				writable: Writable.ADMIN
			};

			expect(updatedMapData).toEqual(expectedMapData);
			expect(storage.maps[createMapData.adminId].mapData).toEqual(expectedMapData);
			expect(onMapData).toHaveBeenLastCalledWith(createMapData.adminId, expectedMapData);
			expect(await (restClient ?? storage.client).getMap(createMapData.adminId)).toEqual(expectedMapData);
		});
	});

	test("Rename map (regular)", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);

		const onMapSlugRename = vi.fn();
		storage.client.on("mapSlugRename", onMapSlugRename);

		const onMapData = vi.fn();
		storage.client.on("mapData", onMapData);

		const createMapData = getTemporaryMapData(storage._version, {});
		let updatedMapData;
		try {
			await storage.client.createMapAndSubscribe(createMapData);

			const update = {
				readId: generateTestMapSlug(),
				writeId: generateTestMapSlug(),
				adminId: generateTestMapSlug()
			} satisfies MapData<CRU.UPDATE>;

			updatedMapData = await (restClient ?? storage.client).updateMap(createMapData.adminId, update) as Extract<MapDataWithWritable, { writable: Writable.ADMIN }>;

			const expectedMapData = {
				...storage.maps[createMapData.adminId].mapData!,
				...update
			} satisfies DeepReadonly<MapDataWithWritable>;

			expect(updatedMapData).toEqual(expectedMapData);
			expect(storage.maps[createMapData.adminId].mapData).toEqual(expectedMapData);
			expect(onMapData).toHaveBeenLastCalledWith(createMapData.adminId, expectedMapData);
			if (useSocket) {
				expect(onMapSlugRename).toHaveBeenCalledWith({ [createMapData.adminId]: expectedMapData.adminId });
			} else {
				await retry(() => {
					expect(onMapSlugRename).toHaveBeenCalledWith({ [createMapData.adminId]: expectedMapData.adminId });
				});
			}

			await expect(async () => await (restClient ?? storage.client).getMap(createMapData.readId)).rejects.toThrow("could not be found");
			await expect(async () => await (restClient ?? storage.client).getMap(createMapData.writeId)).rejects.toThrow("could not be found");
			await expect(async () => await (restClient ?? storage.client).getMap(createMapData.adminId)).rejects.toThrow("could not be found");

			expect(await (restClient ?? storage.client).getMap(update.readId)).toEqual(getMapDataWithWritable(expectedMapData, Writable.READ));
			expect(await (restClient ?? storage.client).getMap(update.writeId)).toEqual(getMapDataWithWritable(expectedMapData, Writable.WRITE));
			expect(await (restClient ?? storage.client).getMap(update.adminId)).toEqual(expectedMapData);
		} finally {
			await (restClient ?? storage.client).deleteMap((updatedMapData ?? createMapData).adminId);
		}
	});

	test("Rename map (ID already taken)", async () => {
		const storage1 = await openClientStorage(undefined, SocketVersion.V3);
		const storage2 = await openClientStorage(undefined, SocketVersion.V3);

		await createTemporaryMap(storage1, {}, async (createMapData1) => {
			await createTemporaryMap(storage2, {}, async (createMapData2) => {
				await expect(async () => {
					await (restClient ?? storage2.client).updateMap(createMapData2.adminId, {
						readId: createMapData1.readId
					});
				}).rejects.toThrowError("already taken");

				await expect(async () => {
					await (restClient ?? storage2.client).updateMap(createMapData2.adminId, {
						writeId: createMapData1.readId
					});
				}).rejects.toThrowError("already taken");

				await expect(async () => {
					await (restClient ?? storage2.client).updateMap(createMapData2.adminId, {
						adminId: createMapData1.readId
					});
				}).rejects.toThrowError("already taken");
			});
		});
	});

	test("Rename map (duplicate IDs)", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);

		await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
			const newId = generateTestMapSlug();

			await expect(async () => {
				await (restClient ?? storage.client).updateMap(createMapData.adminId, {
					readId: newId,
					writeId: newId
				});
			}).rejects.toThrowError("cannot be the same");

			await expect(async () => {
				await (restClient ?? storage.client).updateMap(createMapData.adminId, {
					readId: newId,
					adminId: newId
				});
			}).rejects.toThrowError("cannot be the same");

			await expect(async () => {
				await (restClient ?? storage.client).updateMap(createMapData.adminId, {
					writeId: newId,
					adminId: newId
				});
			}).rejects.toThrowError("cannot be the same");
		});
	});

	test("Delete map", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);

		const mapData = getTemporaryMapData(SocketVersion.V3, {});
		await createTemporaryMap(restClient ?? storage, mapData, async () => {
			const result = await (restClient ?? storage.client).getMap(mapData.adminId);
			expect(result).toBeTruthy();
		});

		if (useSocket) {
			expect(storage.client.mapSubscriptions[mapData.adminId].state.type).toBe(MapSubscriptionStateType.DELETED);
		}

		await expect(() => (restClient ?? storage.client).getMap(mapData.readId)).rejects.toThrowError("could not be found");
	});

	test("Open existing map", async () => {
		const storage1 = await openClientStorage(undefined, SocketVersion.V3);

		await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
			const storage2 = await openClientStorage(createMapData.readId, SocketVersion.V3);
			expect(storage2.maps[createMapData.readId].mapData).toEqual({ ...mapData, writeId: undefined, adminId: undefined, writable: Writable.READ });

			const storage3 = await openClientStorage(createMapData.writeId, SocketVersion.V3);
			expect(storage3.maps[createMapData.writeId].mapData).toEqual({ ...mapData, adminId: undefined, writable: Writable.WRITE });

			const storage4 = await openClientStorage(createMapData.adminId, SocketVersion.V3);
			expect(storage4.maps[createMapData.adminId].mapData).toEqual({ ...mapData, writable: Writable.ADMIN });

			const storage5 = await openClientStorage(undefined, SocketVersion.V3);
			const onMapData5 = vi.fn();
			storage5.client.on("mapData", onMapData5);
			await storage5.client.subscribeToMap(createMapData.readId).subscribePromise;
			expect(onMapData5).toBeCalledTimes(1);
			expect(onMapData5).toBeCalledWith(createMapData.readId, { ...mapData, writeId: undefined, adminId: undefined, writable: Writable.READ });
			expect(storage5.maps[createMapData.readId].mapData).toEqual({ ...mapData, writeId: undefined, adminId: undefined, writable: Writable.READ });

			const storage6 = await openClientStorage(undefined, SocketVersion.V3);
			const onMapData6 = vi.fn();
			storage6.client.on("mapData", onMapData6);
			await storage6.client.subscribeToMap(createMapData.writeId).subscribePromise;
			expect(onMapData6).toBeCalledTimes(1);
			expect(onMapData6).toBeCalledWith(createMapData.writeId, { ...mapData, adminId: undefined, writable: Writable.WRITE });
			expect(storage6.maps[createMapData.writeId].mapData).toEqual({ ...mapData, adminId: undefined, writable: Writable.WRITE });

			const storage7 = await openClientStorage(undefined, SocketVersion.V3);
			const onMapData7 = vi.fn();
			storage7.client.on("mapData", onMapData7);
			await storage7.client.subscribeToMap(createMapData.adminId).subscribePromise;
			expect(onMapData7).toBeCalledTimes(1);
			expect(onMapData7).toBeCalledWith(createMapData.adminId, { ...mapData, writable: Writable.ADMIN });
			expect(storage7.maps[createMapData.adminId].mapData).toEqual({ ...mapData, writable: Writable.ADMIN });
		});
	});

	test("Open non-existing map", async () => {
		const id = generateTestMapSlug();

		const client = await openClient(SocketVersion.V3);
		const subscription = client.subscribeToMap(id);
		await expect(subscription.subscribePromise).rejects.toThrowError("could not be found");
		expect(subscription.state.type).toBe(SubscriptionStateType.FATAL_ERROR);
		expect((subscription.state as Extract<MapSubscriptionState, { type: SubscriptionStateType.FATAL_ERROR }>).error.message).toMatch("could not be found");
	});

	test("Find maps", async () => {
		const uniqueId = generateTestMapSlug();

		const storage = await openClientStorage(undefined, SocketVersion.V3);
		await createTemporaryMap(storage, {
			name: `Test ${uniqueId} map`,
			searchEngines: true
		}, async (createMapData, mapData) => {
			const expectedFound: PagedResults<FindMapsResult> = {
				results: [{ id: mapData.id, readId: mapData.readId, name: `Test ${uniqueId} map`, description: "" }],
				totalLength: 1
			};

			const expectedNotFound: PagedResults<FindMapsResult> = {
				results: [],
				totalLength: 0
			};

			expect(await (restClient ?? storage.client).findMaps(`Test ${uniqueId} map`)).toEqual(expectedFound);
			expect(await (restClient ?? storage.client).findMaps(`test ${uniqueId} map`)).toEqual(expectedFound);
			expect(await (restClient ?? storage.client).findMaps(`Te?t ${uniqueId} map`)).toEqual(expectedFound);
			expect(await (restClient ?? storage.client).findMaps(`Te* ${uniqueId} map`)).toEqual(expectedFound);
			expect(await (restClient ?? storage.client).findMaps(uniqueId)).toEqual(expectedFound);

			expect(await (restClient ?? storage.client).findMaps(`Te ${uniqueId} map`)).toEqual(expectedNotFound);
			expect(await (restClient ?? storage.client).findMaps(`Te? ${uniqueId} map`)).toEqual(expectedNotFound);
			expect(await (restClient ?? storage.client).findMaps(`Te% ${uniqueId} map`)).toEqual(expectedNotFound);

			await (restClient ?? storage.client).updateMap(createMapData.adminId, { searchEngines: false });

			expect(await (restClient ?? storage.client).findMaps(`Test ${uniqueId} map`)).toEqual(expectedNotFound);
		});
	});

});