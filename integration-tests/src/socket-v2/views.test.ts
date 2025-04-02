import { expect, test, vi } from "vitest";
import { createTemporaryMapV2, openClientV2, retry } from "../utils";
import { SocketVersion, type CRU, type ID, type LegacyV2View } from "facilmap-types";
import { cloneDeep } from "lodash-es";

test("Create view (default values)", async () => {
	const client1 = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client1, {}, async (mapData) => {
		const client2 = await openClientV2(mapData.id, SocketVersion.V2);

		const onView1 = vi.fn();
		client1.on("view", onView1);

		const onView2 = vi.fn();
		client2.on("view", onView2);


		const view = {
			name: "Test view 1",
			left: -10,
			right: 10,
			top: -20,
			bottom: 20,
			baseLayer: "Mpnk",
			layers: []
		} satisfies LegacyV2View<CRU.CREATE>;

		const viewResult = await client1.addView(view);

		const expectedView: LegacyV2View = {
			...view,
			idx: 0,
			filter: null,
			id: viewResult.id,
			padId: mapData.id
		};

		expect(viewResult).toEqual(expectedView);

		await retry(async () => {
			expect(onView1).toBeCalledTimes(1);
			expect(onView2).toBeCalledTimes(1);
		});

		expect(onView1).toHaveBeenNthCalledWith(1, expectedView);
		expect(client1.views).toEqual({
			[expectedView.id]: expectedView
		});

		expect(onView2).toHaveBeenNthCalledWith(1, expectedView);
		expect(client2.views).toEqual({
			[expectedView.id]: expectedView
		});

		const client3 = await openClientV2(mapData.id, SocketVersion.V2);
		expect(client3.views).toEqual({
			[expectedView.id]: expectedView
		});
	});
});

test("Create view (custom values)", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	const onView = vi.fn();
	client.on("view", onView);

	await createTemporaryMapV2(client, {}, async (mapData) => {
		const view = {
			name: "Test view 1",
			left: -10,
			right: 10,
			top: -20,
			bottom: 20,
			baseLayer: "Mpnk",
			layers: ["grid"],
			idx: 2,
			filter: "name == 'Test'"
		} satisfies LegacyV2View<CRU.CREATE>;

		const viewResult = await client.addView(view);

		const expectedView: LegacyV2View = {
			...view,
			id: viewResult.id,
			padId: mapData.id
		};

		expect(viewResult).toEqual(expectedView);
		expect(onView).toBeCalledTimes(1);
		expect(onView).toHaveBeenNthCalledWith(1, expectedView);
		expect(cloneDeep(client.views)).toEqual({
			[expectedView.id]: expectedView
		});
	});
});

test("Update view", async () => {
	const client1 = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client1, {}, async (mapData) => {
		const createdView = await client1.addView({
			name: "Test view 1",
			left: -10,
			right: 10,
			top: -20,
			bottom: 20,
			baseLayer: "Mpnk",
			layers: []
		});

		const client2 = await openClientV2(mapData.id, SocketVersion.V2);

		const onView1 = vi.fn();
		client1.on("view", onView1);

		const onView2 = vi.fn();
		client2.on("view", onView2);

		const update = {
			id: createdView.id,
			name: "Test view 2",
			left: -20,
			right: 20,
			top: -40,
			bottom: 40,
			baseLayer: "Lima",
			layers: ["grid"],
			idx: 2,
			filter: "name == 'Test'"
		} satisfies LegacyV2View<CRU.UPDATE> & { id: ID };
		const view = await client1.editView(update);

		const expectedView: LegacyV2View = {
			...update,
			padId: mapData.id
		};

		expect(view).toEqual(expectedView);

		await retry(async () => {
			expect(onView1).toBeCalledTimes(1);
			expect(onView2).toBeCalledTimes(1);
		});

		expect(onView1).toHaveBeenNthCalledWith(1, expectedView);
		expect(onView2).toHaveBeenNthCalledWith(1, expectedView);
		expect(cloneDeep(client1.views)).toEqual({
			[expectedView.id]: expectedView
		});
		expect(cloneDeep(client2.views)).toEqual({
			[expectedView.id]: expectedView
		});

		const client3 = await openClientV2(mapData.id, SocketVersion.V2);
		expect(client3.views).toEqual({
			[expectedView.id]: expectedView
		});
	});
});

test("Set default view", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	const onPadData = vi.fn();
	client.on("padData", onPadData);

	await createTemporaryMapV2(client, {}, async (mapData) => {
		await client.addView({
			name: "Test view 1",
			left: -10,
			right: 10,
			top: -20,
			bottom: 20,
			baseLayer: "Mpnk",
			layers: []
		});

		const view2 = await client.addView({
			name: "Test view 2",
			idx: 1,
			left: -30,
			right: 30,
			top: -40,
			bottom: 40,
			baseLayer: "ToPl",
			layers: ["grid"],
			filter: "name == \"\""
		});

		const mapResult = await client.editPad({
			defaultViewId: view2.id
		});
		expect(mapResult.defaultView).toEqual(view2);
		expect(onPadData.mock.lastCall?.[0].defaultView).toEqual(view2);
	});
});

test("Delete view", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, {}, async (mapData) => {
		const view = await client.addView({
			name: "Test view 1",
			left: -10,
			right: 10,
			top: -20,
			bottom: 20,
			baseLayer: "Mpnk",
			layers: []
		});

		const onDeleteView = vi.fn();
		client.on("deleteView", onDeleteView);

		const deletedView = await client.deleteView({ id: view.id });

		expect(deletedView).toEqual(view);
		expect(onDeleteView).toBeCalledTimes(1);
		expect(onDeleteView).toHaveBeenNthCalledWith(1, { id: view.id });
		expect(client.views).toEqual({});
	});
});

test("Reorder views", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, {}, async (mapData) => {
		const viewSettings = {
			name: "Test view",
			left: -10,
			right: 10,
			top: -20,
			bottom: 20,
			baseLayer: "Mpnk",
			layers: []
		};

		const view1 = await client.addView({
			...viewSettings
		});

		expect(view1.idx).toEqual(0);

		const view2 = await client.addView({
			...viewSettings,
			idx: 3
		});

		expect(view2.idx).toEqual(3);

		const view3 = await client.addView({
			...viewSettings,
			idx: 0 // Should move view1 down, but not view2 (since there is a gap)
		});
		expect(view3.idx).toEqual(0);
		expect(client.views[view1.id].idx).toEqual(1);
		expect(client.views[view2.id].idx).toEqual(3);

		const updatedView1 = await client.editView({
			id: view1.id,
			idx: 0 // Should move view3 down, but not view2 (since there is a gap)
		});
		expect(updatedView1.idx).toEqual(0);
		expect(client.views[view2.id].idx).toEqual(3);
		expect(client.views[view3.id].idx).toEqual(1);

		const newUpdatedView1 = await client.editView({
			id: view1.id,
			idx: 3 // Should move view2 down but leave view3 untouched
		});
		expect(newUpdatedView1.idx).toEqual(3);
		expect(client.views[view2.id].idx).toEqual(4);
		expect(client.views[view3.id].idx).toEqual(1);
	});
});