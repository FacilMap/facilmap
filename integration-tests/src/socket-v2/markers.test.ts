import { expect, test, vi } from "vitest";
import { createTemporaryMapV2, openClient, retry } from "../utils";
import { SocketVersion } from "facilmap-types";
import { cloneDeep } from "lodash-es";

test("Create marker (Socket v2)", async () => {
	// client1: Creates the marker and has it in its bbox
	// client2: Has the marker in its bbox
	// client3: Opens the map later
	// client4: Opens the map later (Socket v3)

	const client1 = await openClient(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client1, {}, async (createMapData, mapData) => {
		const client2 = await openClient(mapData.id, SocketVersion.V2);

		const onMarker1 = vi.fn();
		client1.on("marker", onMarker1);
		const onMarker2 = vi.fn();
		client2.on("marker", onMarker2);

		const markerType = Object.values(client1.types).find((t) => t.type === "marker")!;

		await client1.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await client2.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });

		const marker = await client1.addMarker({
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			ele: null,
			symbol: "test"
		});

		const expectedMarker = {
			symbol: "test",
			padId: mapData.id
		};

		expect(marker).toMatchObject(expectedMarker);

		await retry(() => {
			expect(onMarker1).toHaveBeenCalledTimes(1);
			expect(onMarker2).toHaveBeenCalledTimes(1);
		});

		expect(onMarker1).toHaveBeenCalledWith(expect.objectContaining(expectedMarker));
		expect(onMarker2).toHaveBeenCalledWith(expect.objectContaining(expectedMarker));

		const expectedMarkerRecord = { [marker.id]: expectedMarker };
		expect(cloneDeep(client1.markers)).toMatchObject(expectedMarkerRecord);
		expect(cloneDeep(client2.markers)).toMatchObject(expectedMarkerRecord);

		const client3 = await openClient(mapData.id, SocketVersion.V2);
		await client3.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		expect(cloneDeep(client3.markers)).toMatchObject(expectedMarkerRecord);

		const client4 = await openClient(mapData.id, SocketVersion.V3);
		await client4.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		expect(cloneDeep(client4.markers)).toMatchObject({ [marker.id]: { icon: "test" } });
	});
});

test("Edit marker (socket v2)", async () => {
	// client1: Creates the marker and has it in its bbox
	// client2: Has the marker in its bbox
	// client3: Has the marker in its bbox (Socket v3)

	const client1 = await openClient(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client1, {}, async (createMapData, mapData) => {
		const client2 = await openClient(mapData.id, SocketVersion.V2);
		const client3 = await openClient(mapData.id, SocketVersion.V3);

		const markerType = Object.values(client1.types).find((t) => t.type === "marker")!;

		const createdMarker = await client1.addMarker({
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			ele: null
		});

		await client1.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await client2.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await client3.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });

		const onMarker1 = vi.fn();
		client1.on("marker", onMarker1);
		const onMarker2 = vi.fn();
		client2.on("marker", onMarker2);
		const onMarker3 = vi.fn();
		client3.on("marker", onMarker3);

		const newData = {
			id: createdMarker.id,
			symbol: "icon"
		};
		const marker = await client1.editMarker(newData);

		expect(marker).toMatchObject({ symbol: "icon", padId: mapData.id });

		await retry(() => {
			expect(onMarker1).toHaveBeenCalledTimes(1);
			expect(onMarker2).toHaveBeenCalledTimes(1);
			expect(onMarker3).toHaveBeenCalledTimes(1);
		});

		expect(onMarker1).toHaveBeenCalledWith(expect.objectContaining({ symbol: "icon", padId: mapData.id }));
		expect(onMarker2).toHaveBeenCalledWith(expect.objectContaining({ symbol: "icon", padId: mapData.id }));
		expect(onMarker3).toHaveBeenCalledWith(expect.objectContaining({ icon: "icon" }));
	});
});

test("Delete marker (socket v2)", async () => {
	const client = await openClient(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, {}, async (createMapData, mapData) => {
		const markerType = Object.values(client.types).find((t) => t.type === "marker")!;

		const createdMarker = await client.addMarker({
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			ele: null,
			symbol: "icon"
		});

		const deletedMarker = await client.deleteMarker({ id: createdMarker.id });

		expect(deletedMarker).toEqual(createdMarker);
	});
});

test("Get marker (socket v2)", async () => {
	const client = await openClient(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, {}, async (createMapData, mapData) => {
		const markerType = Object.values(client.types).find((t) => t.type === "marker")!;

		const marker = await client.addMarker({
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			ele: null,
			symbol: "icon"
		});

		expect(await client.getMarker({ id: marker.id })).toMatchObject({ symbol: "icon", padId: mapData.id });
	});
});

test("Find marker (socket v2)", async () => {
	const client = await openClient(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, {}, async (createMapData, mapData) => {
		const markerType = Object.values(client.types).find((t) => t.type === "marker")!;

		await client.addMarker({
			name: "Marker test",
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			symbol: "icon",
			ele: null
		});

		expect(await client.findOnMap({ query: "Test" })).toMatchObject([{ symbol: "icon" }]);
	});
});
