import { expect, test, vi } from "vitest";
import { createTemporaryMapV2, openClient, retry } from "../utils";
import { SocketVersion } from "facilmap-types";
import { cloneDeep } from "lodash-es";

test("Create view (Socket v2)", async () => {
	// client1: Creates the view
	// client2: Has the map open while the view is created
	// client3: Opens the map later

	const client1 = await openClient(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client1, {}, async (createMapData, mapData) => {
		const client2 = await openClient(mapData.id, SocketVersion.V2);

		const onView1 = vi.fn();
		client1.on("view", onView1);
		const onView2 = vi.fn();
		client2.on("view", onView2);

		const view = await client1.addView({
			name: "Test view 1",
			left: -10,
			right: 10,
			top: -20,
			bottom: 20,
			baseLayer: "Mpnk",
			layers: []
		});

		const expectedView = {
			padId: mapData.id
		};

		expect(view).toMatchObject(expectedView);

		await retry(() => {
			expect(onView1).toHaveBeenCalledTimes(1);
			expect(onView2).toHaveBeenCalledTimes(1);
		});

		expect(onView1).toHaveBeenCalledWith(expect.objectContaining(expectedView));
		expect(onView2).toHaveBeenCalledWith(expect.objectContaining(expectedView));

		const expectedViewRecord = { [view.id]: expect.objectContaining(expectedView) };
		expect(cloneDeep(client1.views)).toEqual(expectedViewRecord);
		expect(cloneDeep(client2.views)).toEqual(expectedViewRecord);

		const client3 = await openClient(mapData.id, SocketVersion.V2);
		expect(cloneDeep(client3.views)).toEqual(expectedViewRecord);
	});
});

test("Edit view (socket v2)", async () => {
	// client1: Creates the view and has it in its bbox
	// client2: Has the map open

	const client1 = await openClient(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client1, {}, async (createMapData, mapData) => {
		const client2 = await openClient(mapData.id, SocketVersion.V2);

		const createdView = await client1.addView({
			name: "Test view 1",
			left: -10,
			right: 10,
			top: -20,
			bottom: 20,
			baseLayer: "Mpnk",
			layers: []
		});

		const onView1 = vi.fn();
		client1.on("view", onView1);
		const onView2 = vi.fn();
		client2.on("view", onView2);

		const newData = {
			id: createdView.id,
			baseLayer: "Lima"
		};
		const view = await client1.editView(newData);

		expect(view).toMatchObject({ padId: mapData.id });

		await retry(() => {
			expect(onView1).toHaveBeenCalledTimes(1);
			expect(onView2).toHaveBeenCalledTimes(1);
		});

		expect(onView1).toHaveBeenCalledWith(expect.objectContaining({ padId: mapData.id }));
		expect(onView2).toHaveBeenCalledWith(expect.objectContaining({ padId: mapData.id }));
	});
});

test("Delete view (socket v2)", async () => {
	const client = await openClient(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, {}, async (createMapData, mapData) => {
		const createdView = await client.addView({
			name: "Test view 1",
			left: -10,
			right: 10,
			top: -20,
			bottom: 20,
			baseLayer: "Mpnk",
			layers: []
		});

		const deletedView = await client.deleteView({ id: createdView.id });

		expect(deletedView).toEqual(createdView);
	});
});
