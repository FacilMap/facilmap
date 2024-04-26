import { expect, test, vi } from "vitest";
import { createTemporaryMapV2, openClient, retry } from "../utils";
import { SocketVersion } from "facilmap-types";
import { cloneDeep } from "lodash-es";

test("Create line (Socket v2)", async () => {
	// client1: Creates the line
	// client2: Has the map open while the line is created
	// client3: Opens the map later

	const client1 = await openClient(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client1, {}, async (createMapData, mapData) => {
		const client2 = await openClient(mapData.id, SocketVersion.V2);

		const onLine1 = vi.fn();
		client1.on("line", onLine1);
		const onLine2 = vi.fn();
		client2.on("line", onLine2);

		const lineType = Object.values(client1.types).find((t) => t.type === "line")!;

		const line = await client1.addLine({
			routePoints: [
				{ lat: 6, lon: 6 },
				{ lat: 14, lon: 14 }
			],
			typeId: lineType.id
		});

		const expectedLine = {
			padId: mapData.id
		};

		expect(line).toMatchObject(expectedLine);

		await retry(() => {
			expect(onLine1).toHaveBeenCalledTimes(1);
			expect(onLine2).toHaveBeenCalledTimes(1);
		});

		expect(onLine1).toHaveBeenCalledWith(expect.objectContaining(expectedLine));
		expect(onLine2).toHaveBeenCalledWith(expect.objectContaining(expectedLine));

		const expectedLineRecord = { [line.id]: expect.objectContaining(expectedLine) };
		expect(cloneDeep(client1.lines)).toEqual(expectedLineRecord);
		expect(cloneDeep(client2.lines)).toEqual(expectedLineRecord);

		const client3 = await openClient(mapData.id, SocketVersion.V2);
		expect(cloneDeep(client3.lines)).toEqual(expectedLineRecord);
	});
});

test("Edit line (socket v2)", async () => {
	// client1: Creates the line and has it in its bbox
	// client2: Has the map open

	const client1 = await openClient(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client1, {}, async (createMapData, mapData) => {
		const lineType = Object.values(client1.types).find((t) => t.type === "line")!;

		const createdLine = await client1.addLine({
			routePoints: [
				{ lat: 6, lon: 6 },
				{ lat: 14, lon: 14 }
			],
			typeId: lineType.id
		});

		const client2 = await openClient(mapData.id, SocketVersion.V2);

		const onLine1 = vi.fn();
		client1.on("line", onLine1);
		const onLine2 = vi.fn();
		client2.on("line", onLine2);

		const newData = {
			id: createdLine.id,
			width: 20
		};
		const line = await client1.editLine(newData);

		expect(line).toMatchObject({ padId: mapData.id });

		await retry(() => {
			expect(onLine1).toHaveBeenCalledTimes(1);
			expect(onLine2).toHaveBeenCalledTimes(1);
		});

		expect(onLine1).toHaveBeenCalledWith(expect.objectContaining({ padId: mapData.id }));
		expect(onLine2).toHaveBeenCalledWith(expect.objectContaining({ padId: mapData.id }));
	});
});

test("Delete line (socket v2)", async () => {
	const client = await openClient(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, {}, async (createMapData, mapData) => {
		const lineType = Object.values(client.types).find((t) => t.type === "line")!;

		const createdLine = await client.addLine({
			routePoints: [
				{ lat: 6, lon: 6 },
				{ lat: 14, lon: 14 }
			],
			typeId: lineType.id
		});

		const deletedLine = await client.deleteLine({ id: createdLine.id });

		expect(deletedLine).toEqual(createdLine);
	});
});
