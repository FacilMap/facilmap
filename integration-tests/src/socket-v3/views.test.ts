import { expect, test, vi } from "vitest";
import { createTemporaryMap, openClientStorage, retry } from "../utils";
import { type CRU, type View } from "facilmap-types";
import { cloneDeep } from "lodash-es";

test("Create view (default values)", async () => {
	const storage1 = await openClientStorage();

	await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
		const storage2 = await openClientStorage(mapData.readId);

		const onView1 = vi.fn();
		storage1.client.on("view", onView1);

		const onView2 = vi.fn();
		storage2.client.on("view", onView2);


		const view = {
			name: "Test view 1",
			left: -10,
			right: 10,
			top: -20,
			bottom: 20,
			baseLayer: "Mpnk",
			layers: []
		} satisfies View<CRU.CREATE>;

		const viewResult = await storage1.client.createView(mapData.adminId, view);

		const expectedView: View = {
			...view,
			idx: 0,
			filter: null,
			id: viewResult.id,
			mapId: mapData.id
		};

		expect(viewResult).toEqual(expectedView);

		await retry(async () => {
			expect(onView1).toBeCalledTimes(1);
			expect(onView2).toBeCalledTimes(1);
		});

		expect(onView1).toHaveBeenNthCalledWith(1, mapData.adminId, expectedView);
		expect(storage1.maps[mapData.adminId].views).toEqual({
			[expectedView.id]: expectedView
		});

		expect(onView2).toHaveBeenNthCalledWith(1, mapData.readId, expectedView);
		expect(storage2.maps[mapData.readId].views).toEqual({
			[expectedView.id]: expectedView
		});

		const storage3 = await openClientStorage(mapData.readId);
		expect(storage3.maps[mapData.readId].views).toEqual({
			[expectedView.id]: expectedView
		});
	});
});

test("Create view (custom values)", async () => {
	const storage = await openClientStorage();

	const onView = vi.fn();
	storage.client.on("view", onView);

	await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
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
		} satisfies View<CRU.CREATE>;

		const viewResult = await storage.client.createView(mapData.adminId, view);

		const expectedView: View = {
			...view,
			id: viewResult.id,
			mapId: mapData.id
		};

		expect(viewResult).toEqual(expectedView);
		expect(onView).toBeCalledTimes(1);
		expect(onView).toHaveBeenNthCalledWith(1, mapData.adminId, expectedView);
		expect(cloneDeep(storage.maps[mapData.adminId].views)).toEqual({
			[expectedView.id]: expectedView
		});
	});
});

test("Update view", async () => {
	const storage1 = await openClientStorage();

	await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
		const createdView = await storage1.client.createView(mapData.adminId, {
			name: "Test view 1",
			left: -10,
			right: 10,
			top: -20,
			bottom: 20,
			baseLayer: "Mpnk",
			layers: []
		});

		const storage2 = await openClientStorage(mapData.readId);

		const onView1 = vi.fn();
		storage1.client.on("view", onView1);

		const onView2 = vi.fn();
		storage2.client.on("view", onView2);

		const update = {
			name: "Test view 2",
			left: -20,
			right: 20,
			top: -40,
			bottom: 40,
			baseLayer: "Lima",
			layers: ["grid"],
			idx: 2,
			filter: "name == 'Test'"
		} satisfies View<CRU.UPDATE>;
		const view = await storage1.client.updateView(mapData.adminId, createdView.id, update);

		const expectedView: View = {
			...update,
			id: createdView.id,
			mapId: mapData.id
		};

		expect(view).toEqual(expectedView);

		await retry(async () => {
			expect(onView1).toBeCalledTimes(1);
			expect(onView2).toBeCalledTimes(1);
		});

		expect(onView1).toHaveBeenNthCalledWith(1, mapData.adminId, expectedView);
		expect(onView2).toHaveBeenNthCalledWith(1, mapData.readId, expectedView);
		expect(cloneDeep(storage1.maps[mapData.adminId].views)).toEqual({
			[expectedView.id]: expectedView
		});
		expect(cloneDeep(storage2.maps[mapData.readId].views)).toEqual({
			[expectedView.id]: expectedView
		});

		const storage3 = await openClientStorage(mapData.readId);
		expect(storage3.maps[mapData.readId].views).toEqual({
			[expectedView.id]: expectedView
		});
	});
});

test("Set default view", async () => {
	const storage = await openClientStorage();

	const onMapData = vi.fn();
	storage.client.on("mapData", onMapData);

	await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
		await storage.client.createView(mapData.adminId, {
			name: "Test view 1",
			left: -10,
			right: 10,
			top: -20,
			bottom: 20,
			baseLayer: "Mpnk",
			layers: []
		});

		const view2 = await storage.client.createView(mapData.adminId, {
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

		const mapResult = await storage.client.updateMap(mapData.adminId, {
			defaultViewId: view2.id
		});
		expect(mapResult.defaultView).toEqual(view2);
		expect(onMapData.mock.lastCall?.[0].defaultView).toEqual(view2);
	});
});

test("Delete view", async () => {
	const storage = await openClientStorage();

	await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
		const view = await storage.client.createView(mapData.adminId, {
			name: "Test view 1",
			left: -10,
			right: 10,
			top: -20,
			bottom: 20,
			baseLayer: "Mpnk",
			layers: []
		});

		const onDeleteView = vi.fn();
		storage.client.on("deleteView", onDeleteView);

		await storage.client.deleteView(mapData.adminId, view.id);

		expect(onDeleteView).toBeCalledTimes(1);
		expect(onDeleteView).toHaveBeenNthCalledWith(1, mapData.adminId, { id: view.id });
		expect(storage.maps[mapData.adminId].views).toEqual({});
	});
});

test("Reorder views", async () => {
	const storage = await openClientStorage();

	await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
		const viewSettings = {
			name: "Test view",
			left: -10,
			right: 10,
			top: -20,
			bottom: 20,
			baseLayer: "Mpnk",
			layers: []
		};

		const view1 = await storage.client.createView(mapData.adminId, {
			...viewSettings
		});

		expect(view1.idx).toEqual(0);

		const view2 = await storage.client.createView(mapData.adminId, {
			...viewSettings,
			idx: 3
		});

		expect(view2.idx).toEqual(3);

		const view3 = await storage.client.createView(mapData.adminId, {
			...viewSettings,
			idx: 0 // Should move view1 down, but not view2 (since there is a gap)
		});
		expect(view3.idx).toEqual(0);
		expect(storage.maps[mapData.adminId].views[view1.id].idx).toEqual(1);
		expect(storage.maps[mapData.adminId].views[view2.id].idx).toEqual(3);

		const updatedView1 = await storage.client.updateView(mapData.adminId, view1.id, {
			idx: 0 // Should move view3 down, but not view2 (since there is a gap)
		});
		expect(updatedView1.idx).toEqual(0);
		expect(storage.maps[mapData.adminId].views[view2.id].idx).toEqual(3);
		expect(storage.maps[mapData.adminId].views[view3.id].idx).toEqual(1);

		const newUpdatedView1 = await storage.client.updateView(mapData.adminId, view1.id, {
			idx: 3 // Should move view2 down but leave view3 untouched
		});
		expect(newUpdatedView1.idx).toEqual(3);
		expect(storage.maps[mapData.adminId].views[view2.id].idx).toEqual(4);
		expect(storage.maps[mapData.adminId].views[view3.id].idx).toEqual(1);
	});
});