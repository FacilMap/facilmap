import { expect, test, vi } from "vitest";
import { createTemporaryPad, emit, getTemporaryPadData, openClient, openSocket, retry } from "./utils";
import { SocketVersion, CRU, type Marker, type FindOnMapMarker } from "facilmap-types";
import { cloneDeep } from "lodash-es";

test("Create marker (using default values)", async () => {
	// client1: Creates the marker and has it in its bbox
	// client2: Has the marker in its bbox
	// client3: Does not have the marker in its bbox

	const client1 = await openClient();

	await createTemporaryPad(client1, {}, async (createPadData, padData) => {
		const client2 = await openClient(padData.id);
		const client3 = await openClient(padData.id);

		const onMarker1 = vi.fn();
		client1.on("marker", onMarker1);
		const onMarker2 = vi.fn();
		client2.on("marker", onMarker2);
		const onMarker3 = vi.fn();
		client3.on("marker", onMarker3);

		const markerType = Object.values(client1.types).find((t) => t.type === "marker")!;

		await client1.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await client2.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await client3.updateBbox({ top: 5, bottom: 0, left: 0, right: 5, zoom: 1 });

		const marker = await client1.addMarker({
			lat: 10,
			lon: 10,
			typeId: markerType.id
		});

		const expectedMarker = {
			id: marker.id,
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			padId: padData.id,
			name: "",
			colour: "ff0000",
			size: 30,
			symbol: "",
			shape: "",
			data: {},
			ele: expect.any(Number)
		} satisfies Marker;

		expect(marker).toEqual(expectedMarker);

		await retry(() => {
			expect(onMarker1).toHaveBeenCalledTimes(1);
			expect(onMarker2).toHaveBeenCalledTimes(1);
			expect(onMarker3).toHaveBeenCalledTimes(0);
		});

		expect(onMarker1).toHaveBeenCalledWith(expectedMarker);
		expect(onMarker2).toHaveBeenCalledWith(expectedMarker);

		const expectedMarkerRecord = { [expectedMarker.id]: expectedMarker };
		expect(cloneDeep(client1.markers)).toEqual(expectedMarkerRecord);
		expect(cloneDeep(client2.markers)).toEqual(expectedMarkerRecord);
		expect(cloneDeep(client3.markers)).toEqual({});
	});
});

test("Create marker (using custom values)", async () => {
	const client = await openClient();

	await createTemporaryPad(client, {}, async (createPadData, padData) => {
		const markerType = Object.values(client.types).find((t) => t.type === "marker")!;

		const data: Marker<CRU.CREATE> = {
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			name: "Test marker",
			colour: "0000ff",
			size: 40,
			symbol: "symbol",
			shape: "shape",
			data: {
				test: "value"
			},
			ele: 200
		};

		const marker = await client.addMarker(data);

		const expectedMarker = {
			id: marker.id,
			padId: padData.id,
			...data
		};

		expect(marker).toEqual(expectedMarker);
	});
});

test("Edit marker", async () => {
	// client1: Creates the marker and has it in its bbox
	// client2: Has the marker in its bbox
	// client3: Does not have the marker in its bbox

	const client1 = await openClient();

	await createTemporaryPad(client1, {}, async (createPadData, padData) => {
		const client2 = await openClient(padData.id);
		const client3 = await openClient(padData.id);

		const markerType = Object.values(client1.types).find((t) => t.type === "marker")!;

		await client1.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await client2.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await client3.updateBbox({ top: 5, bottom: 0, left: 0, right: 5, zoom: 1 });

		const createdMarker = await client1.addMarker({
			lat: 10,
			lon: 10,
			typeId: markerType.id
		});

		const secondType = await client1.addType({
			type: "marker",
			name: "Second type"
		});

		const onMarker1 = vi.fn();
		client1.on("marker", onMarker1);
		const onMarker2 = vi.fn();
		client2.on("marker", onMarker2);
		const onMarker3 = vi.fn();
		client3.on("marker", onMarker3);

		const newData: Marker<CRU.UPDATE> = {
			id: createdMarker.id,
			lat: 10,
			lon: 10,
			typeId: secondType.id,
			name: "Test marker",
			colour: "0000ff",
			size: 40,
			symbol: "symbol",
			shape: "shape",
			data: {
				test: "value"
			},
			ele: 200
		};
		const marker = await client1.editMarker(newData);

		const expectedMarker = {
			padId: padData.id,
			...newData
		};

		expect(marker).toEqual(expectedMarker);

		await retry(() => {
			expect(onMarker1).toHaveBeenCalledTimes(1);
			expect(onMarker2).toHaveBeenCalledTimes(1);
			expect(onMarker3).toHaveBeenCalledTimes(0);
		});

		expect(onMarker1).toHaveBeenCalledWith(expectedMarker);
		expect(onMarker2).toHaveBeenCalledWith(expectedMarker);

		const expectedMarkerRecord = { [expectedMarker.id]: expectedMarker };
		expect(cloneDeep(client1.markers)).toEqual(expectedMarkerRecord);
		expect(cloneDeep(client2.markers)).toEqual(expectedMarkerRecord);
		expect(cloneDeep(client3.markers)).toEqual({});
	});
});

test("Delete marker", async () => {
	// client1: Creates the marker and has it in its bbox
	// client2: Has the marker in its bbox
	// client3: Does not have the marker in its bbox

	const client1 = await openClient();

	await createTemporaryPad(client1, {}, async (createPadData, padData) => {
		const client2 = await openClient(padData.id);
		const client3 = await openClient(padData.id);

		const markerType = Object.values(client1.types).find((t) => t.type === "marker")!;

		await client1.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await client2.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await client3.updateBbox({ top: 5, bottom: 0, left: 0, right: 5, zoom: 1 });

		const createdMarker = await client1.addMarker({
			lat: 10,
			lon: 10,
			typeId: markerType.id
		});

		const onDeleteMarker1 = vi.fn();
		client1.on("deleteMarker", onDeleteMarker1);
		const onDeleteMarker2 = vi.fn();
		client2.on("deleteMarker", onDeleteMarker2);
		const onDeleteMarker3 = vi.fn();
		client3.on("deleteMarker", onDeleteMarker3);

		const deletedMarker = await client1.deleteMarker({ id: createdMarker.id });

		expect(deletedMarker).toEqual(createdMarker);

		await retry(() => {
			expect(onDeleteMarker1).toHaveBeenCalledTimes(1);
			expect(onDeleteMarker2).toHaveBeenCalledTimes(1);
			expect(onDeleteMarker3).toHaveBeenCalledTimes(1);
		});

		expect(onDeleteMarker1).toHaveBeenCalledWith({ id: deletedMarker.id });
		expect(onDeleteMarker2).toHaveBeenCalledWith({ id: deletedMarker.id });
		expect(onDeleteMarker3).toHaveBeenCalledWith({ id: deletedMarker.id });

		const expectedMarkerRecord = { };
		expect(cloneDeep(client1.markers)).toEqual(expectedMarkerRecord);
		expect(cloneDeep(client2.markers)).toEqual(expectedMarkerRecord);
		expect(cloneDeep(client3.markers)).toEqual({});
	});
});

test("Get marker", async () => {
	const client1 = await openClient();

	await createTemporaryPad(client1, {}, async (createPadData, padData) => {
		const client2 = await openClient(padData.id);

		const markerType = Object.values(client1.types).find((t) => t.type === "marker")!;

		const marker = await client1.addMarker({
			lat: 10,
			lon: 10,
			typeId: markerType.id
		});

		const expectedMarker = {
			id: marker.id,
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			padId: padData.id,
			name: "",
			colour: "ff0000",
			size: 30,
			symbol: "",
			shape: "",
			data: {},
			ele: expect.any(Number)
		} satisfies Marker;

		expect(await client2.getMarker({ id: marker.id })).toEqual(expectedMarker);
	});
});

test("Find marker", async () => {
	const client1 = await openClient();

	await createTemporaryPad(client1, {}, async (createPadData, padData) => {
		const client2 = await openClient(padData.id);

		const markerType = Object.values(client1.types).find((t) => t.type === "marker")!;

		const marker = await client1.addMarker({
			name: "Marker test",
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			symbol: "a"
		});

		const expectedResult: FindOnMapMarker = {
			id: marker.id,
			kind: "marker",
			similarity: 1,
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			name: "Marker test",
			symbol: "a"
		};

		expect(await client2.findOnMap({ query: "Test" })).toEqual([{ ...expectedResult, similarity: 0.3333333333333333 }]);
		expect(await client2.findOnMap({ query: "T_st" })).toEqual([{ ...expectedResult, similarity: 0.16666666666666666 }]);
		expect(await client2.findOnMap({ query: "M%r" })).toEqual([{ ...expectedResult, similarity: 0 }]);
		expect(await client2.findOnMap({ query: "Bla" })).toEqual([]);
	});
});

test("Try to create marker with line type", async () => {
	const client = await openClient();

	await createTemporaryPad(client, {}, async (createPadData) => {
		const lineType = Object.values(client.types).find((t) => t.type === "line")!;

		await expect(async () => {
			await client.addMarker({
				lat: 10,
				lon: 10,
				typeId: lineType.id
			});
		}).rejects.toThrowError("Cannot use line type for marker");

		const client3 = await openClient(createPadData.adminId);
		await client3.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		expect(cloneDeep(client3.markers)).toEqual({});
	});
});

test("Try to update marker with line type", async () => {
	const client = await openClient();

	await createTemporaryPad(client, {}, async (createPadData) => {
		const markerType = Object.values(client.types).find((t) => t.type === "marker")!;
		const lineType = Object.values(client.types).find((t) => t.type === "line")!;

		const marker = await client.addMarker({
			lat: 10,
			lon: 10,
			typeId: markerType.id
		});

		await expect(async () => {
			await client.editMarker({
				id: marker.id,
				typeId: lineType.id
			});
		}).rejects.toThrowError("Cannot use line type for marker");

		const client3 = await openClient(createPadData.adminId);
		await client3.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		expect(cloneDeep(client3.markers)).toEqual({
			[marker.id]: marker
		});
	});
});

test("Try to create marker with marker type from other pad", async () => {
	const client1 = await openClient();
	const client2 = await openClient();

	await createTemporaryPad(client1, {}, async (createPadData) => {
		await createTemporaryPad(client2, {}, async () => {
			const markerType2 = Object.values(client2.types).find((t) => t.type === "marker")!;

			await expect(async () => {
				await client1.addMarker({
					lat: 10,
					lon: 10,
					typeId: markerType2.id
				});
			}).rejects.toThrowError("could not be found");

			const client3 = await openClient(createPadData.adminId);
			await client3.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
			expect(cloneDeep(client3.markers)).toEqual({});
		});
	});
});

test("Try to update marker with marker type from other pad", async () => {
	const client1 = await openClient();
	const client2 = await openClient();

	await createTemporaryPad(client1, {}, async (createPadData) => {
		await createTemporaryPad(client2, {}, async () => {
			const markerType1 = Object.values(client1.types).find((t) => t.type === "marker")!;
			const markerType2 = Object.values(client2.types).find((t) => t.type === "marker")!;

			const marker = await client1.addMarker({
				lat: 10,
				lon: 10,
				typeId: markerType1.id
			});

			await expect(async () => {
				await client1.editMarker({
					id: marker.id,
					typeId: markerType2.id
				});
			}).rejects.toThrowError("could not be found");

			const client3 = await openClient(createPadData.adminId);
			await client3.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
			expect(cloneDeep(client3.markers)).toEqual({
				[marker.id]: marker
			});
		});
	});
});

test("Socket v1 marker name", async () => {
	// socket1: Creates the marker and has it in its bbox
	// socket2: Has the marker in its bbox
	// socket3: Does not have the marker in its bbox
	const socket1 = await openSocket(SocketVersion.V1);
	const socket2 = await openSocket(SocketVersion.V1);
	const socket3 = await openSocket(SocketVersion.V1);

	const onMarker1 = vi.fn();
	socket1.on("marker", onMarker1);
	const onMarker2 = vi.fn();
	socket2.on("marker", onMarker2);
	const onMarker3 = vi.fn();
	socket3.on("marker", onMarker3);

	try {
		const padData = getTemporaryPadData({});
		const padResult = await emit(socket1, "createPad", padData);
		await emit(socket2, "setPadId", padData.adminId);
		await emit(socket3, "setPadId", padData.adminId);

		const markerType = padResult.type!.find((t) => t.type === "marker")!;

		await emit(socket1, "updateBbox", { top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await emit(socket2, "updateBbox", { top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await emit(socket3, "updateBbox", { top: 5, bottom: 0, left: 0, right: 5, zoom: 1 });

		const marker = await emit(socket1, "addMarker", {
			lat: 10,
			lon: 10,
			typeId: markerType.id
		});

		const expectedMarker = {
			id: marker.id,
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			padId: padData.id,
			name: "Untitled marker",
			colour: "ff0000",
			size: 30,
			symbol: "",
			shape: "",
			data: {},
			ele: expect.any(Number)
		} satisfies Marker;

		expect(marker).toEqual(expectedMarker);

		await retry(() => {
			expect(onMarker1).toHaveBeenCalledTimes(1);
			expect(onMarker2).toHaveBeenCalledTimes(1);
			expect(onMarker3).toHaveBeenCalledTimes(0);
		});

		expect(onMarker1).toHaveBeenCalledWith(expectedMarker);
		expect(onMarker2).toHaveBeenCalledWith(expectedMarker);
	} finally {
		await emit(socket1, "deletePad", undefined);
	}
});
