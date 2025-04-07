import { describe, expect, test, vi } from "vitest";
import { createTemporaryMap, getRestClient, openClientStorage, retry } from "../utils";
import { ApiVersion, SocketVersion, type CRU, type View } from "facilmap-types";
import { cloneDeep } from "lodash-es";

describe.for([
	{ label: "Socket API", useSocket: true },
	{ label: "REST API", useSocket: false }
])("View tests ($label)", ({ useSocket }) => {

	const restClient = useSocket ? undefined : getRestClient(ApiVersion.V3);

	test("Create view (default values)", async () => {
		const storage1 = await openClientStorage(undefined, SocketVersion.V3);

		await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
			const storage2 = await openClientStorage(mapData.readId, SocketVersion.V3);

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

			const viewResult = await (restClient ?? storage1.client).createView(mapData.adminId, view);

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

			const storage3 = await openClientStorage(mapData.readId, SocketVersion.V3);
			expect(storage3.maps[mapData.readId].views).toEqual({
				[expectedView.id]: expectedView
			});
		});
	});

	test("Create view (custom values)", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);

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

			const viewResult = await (restClient ?? storage.client).createView(mapData.adminId, view);

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
		const storage1 = await openClientStorage(undefined, SocketVersion.V3);

		await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
			const createdView = await (restClient ?? storage1.client).createView(mapData.adminId, {
				name: "Test view 1",
				left: -10,
				right: 10,
				top: -20,
				bottom: 20,
				baseLayer: "Mpnk",
				layers: []
			});

			const storage2 = await openClientStorage(mapData.readId, SocketVersion.V3);

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
			const view = await (restClient ?? storage1.client).updateView(mapData.adminId, createdView.id, update);

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

			const storage3 = await openClientStorage(mapData.readId, SocketVersion.V3);
			expect(storage3.maps[mapData.readId].views).toEqual({
				[expectedView.id]: expectedView
			});
		});
	});

	test("Set default view", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);

		const onMapData = vi.fn();
		storage.client.on("mapData", onMapData);

		await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
			await (restClient ?? storage.client).createView(mapData.adminId, {
				name: "Test view 1",
				left: -10,
				right: 10,
				top: -20,
				bottom: 20,
				baseLayer: "Mpnk",
				layers: []
			});

			const view2 = await (restClient ?? storage.client).createView(mapData.adminId, {
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

			const mapResult = await (restClient ?? storage.client).updateMap(mapData.adminId, {
				defaultViewId: view2.id
			});
			expect(mapResult.defaultView).toEqual(view2);
			expect(onMapData.mock.lastCall?.[1].defaultView).toEqual(view2);
		});
	});

	test("Delete view", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);

		await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
			const view = await (restClient ?? storage.client).createView(mapData.adminId, {
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

			await (restClient ?? storage.client).deleteView(mapData.adminId, view.id);

			expect(onDeleteView).toBeCalledTimes(1);
			expect(onDeleteView).toHaveBeenNthCalledWith(1, mapData.adminId, { id: view.id });
			expect(storage.maps[mapData.adminId].views).toEqual({});
		});
	});

	test("Reorder views", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);

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

			const view1 = await (restClient ?? storage.client).createView(mapData.adminId, {
				...viewSettings
			});

			expect(view1.idx).toEqual(0);

			const view2 = await (restClient ?? storage.client).createView(mapData.adminId, {
				...viewSettings,
				idx: 3
			});

			expect(view2.idx).toEqual(3);

			const view3 = await (restClient ?? storage.client).createView(mapData.adminId, {
				...viewSettings,
				idx: 0 // Should move view1 down, but not view2 (since there is a gap)
			});
			expect(view3.idx).toEqual(0);
			expect(storage.maps[mapData.adminId].views[view1.id].idx).toEqual(1);
			expect(storage.maps[mapData.adminId].views[view2.id].idx).toEqual(3);

			const updatedView1 = await (restClient ?? storage.client).updateView(mapData.adminId, view1.id, {
				idx: 0 // Should move view3 down, but not view2 (since there is a gap)
			});
			expect(updatedView1.idx).toEqual(0);
			expect(storage.maps[mapData.adminId].views[view2.id].idx).toEqual(3);
			expect(storage.maps[mapData.adminId].views[view3.id].idx).toEqual(1);

			const newUpdatedView1 = await (restClient ?? storage.client).updateView(mapData.adminId, view1.id, {
				idx: 3 // Should move view2 down but leave view3 untouched
			});
			expect(newUpdatedView1.idx).toEqual(3);
			expect(storage.maps[mapData.adminId].views[view2.id].idx).toEqual(4);
			expect(storage.maps[mapData.adminId].views[view3.id].idx).toEqual(1);
		});
	});

});