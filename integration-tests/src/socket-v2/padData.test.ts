import { expect, test, vi } from "vitest";
import { createTemporaryMapV2, generateTestMapSlug, getFacilMapUrl, getTemporaryMapData, openClientV2 } from "../utils";
import { Writable, CRU, type LegacyV2FindMapsResult, type PagedResults, SocketVersion, type LegacyV2MapData } from "facilmap-types";
import { pick } from "lodash-es";
import Client from "facilmap-client-v4";

test("Create map (using default values)", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	const onPadData = vi.fn();
	client.on("padData", onPadData);

	await createTemporaryMapV2(client, {}, async (createPadData, padData) => {
		const expectedPadData: LegacyV2MapData & { writable: Writable } = {
			...createPadData,
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

		expect(client.padId).toBe(createPadData.adminId);
		expect(client.readonly).toBe(false);
		expect(client.writable).toBe(Writable.ADMIN);
		expect(client.serverError).toBe(undefined);

		expect(padData).toEqual(expectedPadData);
		expect(client.padData).toEqual(expectedPadData);
		expect(onPadData).toBeCalledTimes(1);
		expect(onPadData).toHaveBeenCalledWith(expectedPadData);
		expect(await client.getPad({ padId: createPadData.id })).toEqual(pick(expectedPadData, ["id", "name", "description"]));
	});
});

test("Create map (using custom values)", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	const onPadData = vi.fn();
	client.on("padData", onPadData);

	await createTemporaryMapV2(client, {
		name: "Test map",
		searchEngines: true,
		description: "Test description",
		clusterMarkers: true,
		legend1: "Legend 1",
		legend2: "Legend 1",
		defaultViewId: null
	}, async (createPadData, padData) => {
		const expectedPadData: LegacyV2MapData & { writable: Writable } = {
			...createPadData,
			defaultView: null,
			writable: Writable.ADMIN
		};

		expect(client.padId).toBe(createPadData.adminId);
		expect(client.readonly).toBe(false);
		expect(client.writable).toBe(Writable.ADMIN);
		expect(client.serverError).toBe(undefined);

		expect(padData).toEqual(expectedPadData);
		expect(client.padData).toEqual(expectedPadData);
		expect(onPadData).toBeCalledTimes(1);
		expect(onPadData).toHaveBeenCalledWith(expectedPadData);
		expect(await client.getPad({ padId: createPadData.id })).toEqual(pick(expectedPadData, ["id", "name", "description"]));
	});
});

test("Create map (ID already taken)", async () => {
	const client1 = await openClientV2(undefined, SocketVersion.V2);
	const client2 = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client1, {}, async (createPadData1) => {
		await expect(async () => {
			await createTemporaryMapV2(client2, {
				id: createPadData1.id
			})
		}).rejects.toThrowError("already taken");

		await expect(async () => {
			await createTemporaryMapV2(client2, {
				writeId: createPadData1.id
			})
		}).rejects.toThrowError("already taken");

		await expect(async () => {
			await createTemporaryMapV2(client2, {
				adminId: createPadData1.id
			})
		}).rejects.toThrowError("already taken");
	});
});

test("Create map (duplicate IDs)", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	const newId = generateTestMapSlug();

	await expect(async () => {
		await createTemporaryMapV2(client, {
			id: newId,
			writeId: newId
		});
	}).rejects.toThrowError("have to be different");

	await expect(async () => {
		await createTemporaryMapV2(client, {
			id: newId,
			adminId: newId
		});
	}).rejects.toThrowError("have to be different");

	await expect(async () => {
		await createTemporaryMapV2(client, {
			writeId: newId,
			adminId: newId
		});
	}).rejects.toThrowError("have to be different");
});

test("Edit map", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	const onPadData = vi.fn();
	client.on("padData", onPadData);

	await createTemporaryMapV2(client, {}, async (createPadData, padData) => {
		const update = {
			name: "Test map",
			searchEngines: true,
			description: "Test description",
			clusterMarkers: true,
			legend1: "Legend 1",
			legend2: "Legend 1"
		} satisfies LegacyV2MapData<CRU.UPDATE>;

		const updatedPadData = await client.editPad(update);

		const expectedPadData: LegacyV2MapData & { writable: Writable } = {
			...createPadData,
			...update,
			defaultViewId: null,
			defaultView: null,
			writable: Writable.ADMIN
		};

		expect(updatedPadData).toEqual(expectedPadData);
		expect(client.padData).toEqual(expectedPadData);
		expect(onPadData).toHaveBeenLastCalledWith(expectedPadData);
		expect(await client.getPad({ padId: createPadData.id })).toEqual(pick(expectedPadData, ["id", "name", "description"]));
	});
});

test("Rename map", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	const onPadData = vi.fn();
	client.on("padData", onPadData);

	await createTemporaryMapV2(client, {}, async (createPadData, padData) => {
		const update = {
			id: generateTestMapSlug(),
			writeId: generateTestMapSlug(),
			adminId: generateTestMapSlug()
		} satisfies LegacyV2MapData<CRU.UPDATE>;

		const updatedPadData = await client.editPad(update);

		const expectedPadData: LegacyV2MapData = {
			...padData,
			...update
		};

		expect(updatedPadData).toEqual(expectedPadData);
		expect(client.padData).toEqual(expectedPadData);
		expect(onPadData).toHaveBeenLastCalledWith(expectedPadData);

		expect(await client.getPad({ padId: createPadData.id })).toBeNull();
		expect(await client.getPad({ padId: createPadData.writeId })).toBeNull();
		expect(await client.getPad({ padId: createPadData.adminId })).toBeNull();

		expect(await client.getPad({ padId: update.id })).toEqual(pick(expectedPadData, ["id", "name", "description"]));
		expect(await client.getPad({ padId: update.writeId })).toEqual(pick(expectedPadData, ["id", "name", "description"]));
		expect(await client.getPad({ padId: update.adminId })).toEqual(pick(expectedPadData, ["id", "name", "description"]));
	});
});

test("Rename map (ID already taken)", async () => {
	const client1 = await openClientV2(undefined, SocketVersion.V2);
	const client2 = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client1, {}, async (createPadData1) => {
		await createTemporaryMapV2(client2, {}, async (createPadData2) => {
			await expect(async () => {
				await client2.editPad({
					id: createPadData1.id
				});
			}).rejects.toThrowError("already taken");

			await expect(async () => {
				await client2.editPad({
					writeId: createPadData1.id
				});
			}).rejects.toThrowError("already taken");

			await expect(async () => {
				await client2.editPad({
					adminId: createPadData1.id
				});
			}).rejects.toThrowError("already taken");
		});
	});
});

test("Rename map (duplicate IDs)", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, {}, async () => {
		const newId = generateTestMapSlug();

		await expect(async () => {
			await client.editPad({
				id: newId,
				writeId: newId
			});
		}).rejects.toThrowError("cannot be the same");

		await expect(async () => {
			await client.editPad({
				id: newId,
				adminId: newId
			});
		}).rejects.toThrowError("cannot be the same");

		await expect(async () => {
			await client.editPad({
				writeId: newId,
				adminId: newId
			});
		}).rejects.toThrowError("cannot be the same");
	});
});

test("Delete map", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	const padData = getTemporaryMapData(SocketVersion.V2, {});
	await createTemporaryMapV2(client, padData, async () => {
		expect(client.deleted).toBe(false);

		const result = await client.getPad({ padId: padData.id });
		expect(result).toBeTruthy();
	});

	expect(client.deleted).toBe(true);

	const result = await client.getPad({ padId: padData.id });
	expect(result).toBeNull();
});

test("Open existing map", async () => {
	const client1 = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client1, {}, async (createPadData, padData) => {
		const client2 = await openClientV2(createPadData.id, SocketVersion.V2);
		expect(client2.padData).toEqual({ ...padData, writeId: undefined, adminId: undefined, writable: Writable.READ });

		const client3 = await openClientV2(createPadData.writeId, SocketVersion.V2);
		expect(client3.padData).toEqual({ ...padData, adminId: undefined, writable: Writable.WRITE });

		const client4 = await openClientV2(createPadData.adminId, SocketVersion.V2);
		expect(client4.padData).toEqual({ ...padData, writable: Writable.ADMIN });

		const client5 = await openClientV2(undefined, SocketVersion.V2);
		const onPadData5 = vi.fn();
		client5.on("padData", onPadData5);
		const result5 = await client5.setPadId(createPadData.id);
		expect(result5.padData![0]).toEqual({ ...padData, writeId: undefined, adminId: undefined, writable: Writable.READ });
		expect(onPadData5).toBeCalledTimes(1);
		expect(onPadData5).toBeCalledWith({ ...padData, writeId: undefined, adminId: undefined, writable: Writable.READ });
		expect(client5.padData).toEqual({ ...padData, writeId: undefined, adminId: undefined, writable: Writable.READ });

		const client6 = await openClientV2(undefined, SocketVersion.V2);
		const onPadData6 = vi.fn();
		client6.on("padData", onPadData6);
		const result6 = await client6.setPadId(createPadData.writeId);
		expect(result6.padData![0]).toEqual({ ...padData, adminId: undefined, writable: Writable.WRITE });
		expect(onPadData6).toBeCalledTimes(1);
		expect(onPadData6).toBeCalledWith({ ...padData, adminId: undefined, writable: Writable.WRITE });
		expect(client6.padData).toEqual({ ...padData, adminId: undefined, writable: Writable.WRITE });

		const client7 = await openClientV2(undefined, SocketVersion.V2);
		const onPadData7 = vi.fn();
		client7.on("padData", onPadData7);
		const result7 = await client7.setPadId(createPadData.adminId);
		expect(result7.padData![0]).toEqual({ ...padData, writable: Writable.ADMIN });
		expect(onPadData7).toBeCalledTimes(1);
		expect(onPadData7).toBeCalledWith({ ...padData, writable: Writable.ADMIN });
		expect(client7.padData).toEqual({ ...padData, writable: Writable.ADMIN });
	});
});

test("Open non-existing map", async () => {
	const id = generateTestMapSlug();

	const client1 = new Client(getFacilMapUrl(), id, { reconnection: false });
	await expect(new Promise<any>((resolve, reject) => {
		client1.on("padData", resolve);
		client1.on("serverError", reject);
		client1.on("connect_error", reject);
	})).rejects.toThrowError("does not exist");
	expect(client1.serverError?.message).toMatch("does not exist");

	const client2 = await openClientV2(undefined, SocketVersion.V2);
	await expect(async () => {
		await client2.setPadId(id);
	}).rejects.toThrowError("does not exist");
	expect(client2.serverError?.message).toMatch("does not exist");
});

test("Find maps", async () => {
	const uniqueId = generateTestMapSlug();

	const client = await openClientV2(undefined, SocketVersion.V2);
	await createTemporaryMapV2(client, {
		name: `Test ${uniqueId} map`,
		searchEngines: true
	}, async (createPadData) => {
		const expectedFound: PagedResults<LegacyV2FindMapsResult> = {
			results: [{ id: createPadData.id, name: `Test ${uniqueId} map`, description: "" }],
			totalLength: 1
		};

		const expectedNotFound: PagedResults<LegacyV2FindMapsResult> = {
			results: [],
			totalLength: 0
		};

		expect(await client.findPads({ query: `Test ${uniqueId} map` })).toEqual(expectedFound);
		expect(await client.findPads({ query: `test ${uniqueId} map` })).toEqual(expectedFound);
		expect(await client.findPads({ query: `Te?t ${uniqueId} map` })).toEqual(expectedFound);
		expect(await client.findPads({ query: `Te* ${uniqueId} map` })).toEqual(expectedFound);
		expect(await client.findPads({ query: uniqueId })).toEqual(expectedFound);

		expect(await client.findPads({ query: `Te ${uniqueId} map` })).toEqual(expectedNotFound);
		expect(await client.findPads({ query: `Te? ${uniqueId} map` })).toEqual(expectedNotFound);
		expect(await client.findPads({ query: `Te% ${uniqueId} map` })).toEqual(expectedNotFound);

		await client.editPad({ searchEngines: false });

		expect(await client.findPads({ query: `Test ${uniqueId} map` })).toEqual(expectedNotFound);
	});
});