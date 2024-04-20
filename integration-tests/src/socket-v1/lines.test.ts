import { expect, test, vi } from "vitest";
import { createTemporaryMapV2, openClient, retry } from "../utils";
import { SocketVersion, type Line } from "facilmap-types";

test("Socket v1 line name", async () => {
	// client1: Creates the line and has it in its bbox
	// client2: Has the line in its bbox
	// client3: Does not have the line in its bbox
	const client1 = await openClient(undefined, SocketVersion.V1);

	await createTemporaryMapV2(client1, {}, async (createMapData, mapData) => {
		const client2 = await openClient(mapData.adminId, SocketVersion.V1);
		const client3 = await openClient(mapData.adminId, SocketVersion.V1);

		const onLine1 = vi.fn();
		client1.on("line", onLine1);
		const onLine2 = vi.fn();
		client2.on("line", onLine2);
		const onLine3 = vi.fn();
		client3.on("line", onLine3);

		const lineType = Object.values(client1.types).find((t) => t.type === "line")!;

		await client1.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await client2.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await client3.updateBbox({ top: 5, bottom: 0, left: 0, right: 5, zoom: 1 });

		const line = await client1.addLine({
			routePoints: [
				{ lat: 6, lon: 6 },
				{ lat: 14, lon: 14 }
			],
			typeId: lineType.id
		});

		const expectedLine = {
			id: line.id,
			routePoints: [
				{ lat: 6, lon: 6 },
				{ lat: 14, lon: 14 }
			],
			typeId: lineType.id,
			padId: mapData.id,
			name: "Untitled line",
			mode: "",
			colour: "0000ff",
			width: 4,
			stroke: "",
			distance: 1247.95,
			time: null,
			ascent: null,
			descent: null,
			extraInfo: null,
			top: 14,
			right: 14,
			bottom: 6,
			left: 6,
			data: {}
		} satisfies Line;

		expect(line).toEqual(expectedLine);

		await retry(() => {
			expect(onLine1).toHaveBeenCalledTimes(1);
			expect(onLine2).toHaveBeenCalledTimes(1);
			expect(onLine3).toHaveBeenCalledTimes(1);
		});

		expect(onLine1).toHaveBeenCalledWith(expectedLine);
		expect(onLine2).toHaveBeenCalledWith(expectedLine);
		expect(onLine3).toHaveBeenCalledWith(expectedLine);
	});
});