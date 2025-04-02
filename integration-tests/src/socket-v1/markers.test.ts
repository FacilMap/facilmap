import { expect, test, vi } from "vitest";
import { createTemporaryMapV2, openClientV2, retry } from "../utils";
import { SocketVersion } from "facilmap-types";
import type { LegacyV2Marker } from "facilmap-types";

test("Socket v1 marker name", async () => {
	// client1: Creates the marker and has it in its bbox
	// client2: Has the marker in its bbox
	// client3: Does not have the marker in its bbox
	const client1 = await openClientV2(undefined, SocketVersion.V1);

	await createTemporaryMapV2(client1, {}, async (createMapData, mapData) => {
		const client2 = await openClientV2(mapData.adminId, SocketVersion.V1);
		const client3 = await openClientV2(mapData.adminId, SocketVersion.V1);

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
			typeId: markerType.id,
			ele: null as any
		});

		const expectedMarker = {
			id: marker.id,
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			padId: mapData.id,
			name: "Untitled marker",
			colour: "ff0000",
			size: 30,
			symbol: "",
			shape: "",
			data: {},
			ele: null
		} satisfies LegacyV2Marker;

		expect(marker).toEqual(expectedMarker);

		await retry(() => {
			expect(onMarker1).toHaveBeenCalledTimes(1);
			expect(onMarker2).toHaveBeenCalledTimes(1);
			expect(onMarker3).toHaveBeenCalledTimes(0);
		});

		expect(onMarker1).toHaveBeenCalledWith(expectedMarker);
		expect(onMarker2).toHaveBeenCalledWith(expectedMarker);
	});
});
