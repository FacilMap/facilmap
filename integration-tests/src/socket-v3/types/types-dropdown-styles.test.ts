import { describe, expect, test, vi } from "vitest";
import { createTemporaryMap, getRestClient, openClientStorage } from "../../utils";
import { ApiVersion, SocketVersion } from "facilmap-types";

describe.for([
	{ label: "Socket API", useSocket: true },
	{ label: "REST API", useSocket: false }
])("Type dropdown style tests ($label)", ({ useSocket }) => {

	const restClient = useSocket ? undefined : getRestClient(ApiVersion.V3);

	test("New marker is created with dropdown styles", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);

		await createTemporaryMap(storage, { createDefaultTypes: false }, async (createMapData, mapData) => {
			const type = await (restClient ?? storage.client).createType(mapData.adminId, {
				name: "Test type",
				type: "marker",
				fields: [
					{
						name: "Dropdown",
						type: "dropdown",
						controlColour: true,
						controlSize: true,
						controlIcon: true,
						controlShape: true,
						options: [
							{ value: "Value 1", colour: "00ffff", size: 60, icon: "z", shape: "rectangle" },
							{ value: "Value 2", colour: "00ff00", size: 50, icon: "a", shape: "circle" }
						],
						default: "Value 2"
					}
				]
			});

			const marker = await (restClient ?? storage.client).createMarker(mapData.adminId, {
				lat: 0,
				lon: 0,
				typeId: type.id,
				colour: "ffffff",
				size: 20,
				icon: "b",
				shape: "drop"
			});

			expect(marker).toMatchObject({
				colour: "00ff00",
				size: 50,
				icon: "a",
				shape: "circle",
			});
		});
	});

	test("New line is created with dropdown styles", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);

		await createTemporaryMap(storage, { createDefaultTypes: false }, async (createMapData, mapData) => {
			const type = await (restClient ?? storage.client).createType(mapData.adminId, {
				name: "Test type",
				type: "line",
				fields: [
					{
						name: "Dropdown",
						type: "dropdown",
						controlColour: true,
						controlWidth: true,
						controlStroke: true,
						options: [
							{ value: "Value 1", colour: "00ffff", width: 11, stroke: "dashed" },
							{ value: "Value 2", colour: "00ff00", width: 10, stroke: "dotted" }
						],
						default: "Value 2"
					}
				]
			});

			const line = await (restClient ?? storage.client).createLine(mapData.adminId, {
				routePoints: [
					{ lat: 0, lon: 0 },
					{ lat: 1, lon: 1 }
				],
				typeId: type.id,
				colour: "ffffff",
				width: 20,
				stroke: "dashed"
			});

			expect(line).toMatchObject({
				colour: "00ff00",
				width: 10,
				stroke: "dotted"
			});
		});
	});

	test("Line template uses dropdown styles", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);

		await createTemporaryMap(storage, { createDefaultTypes: false }, async (createMapData, mapData) => {
			const type = await (restClient ?? storage.client).createType(mapData.adminId, {
				name: "Test type",
				type: "line",
				fields: [
					{
						name: "Dropdown",
						type: "dropdown",
						controlColour: true,
						controlWidth: true,
						controlStroke: true,
						options: [
							{ value: "Value 1", colour: "00ffff", width: 11, stroke: "dashed" },
							{ value: "Value 2", colour: "00ff00", width: 10, stroke: "dotted" }
						],
						default: "Value 2"
					}
				]
			});

			const lineTemplate = await (restClient ?? storage.client).getLineTemplate(mapData.adminId, {
				typeId: type.id
			});

			expect(lineTemplate).toEqual({
				typeId: type.id,
				name: "",
				colour: "00ff00",
				width: 10,
				stroke: "dotted",
				mode: "",
				data: {}
			});
		});
	});

	test("Marker update is overridden by dropdown styles", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);

		await createTemporaryMap(storage, { createDefaultTypes: false }, async (createMapData, mapData) => {
			const type = await (restClient ?? storage.client).createType(mapData.adminId, {
				name: "Test type",
				type: "marker",
				fields: [
					{
						name: "Dropdown",
						type: "dropdown",
						controlColour: true,
						controlSize: true,
						controlIcon: true,
						controlShape: true,
						options: [
							{ value: "Value 1", colour: "00ffff", size: 60, icon: "z", shape: "rectangle" },
							{ value: "Value 2", colour: "00ff00", size: 50, icon: "a", shape: "circle" }
						],
						default: "Value 2"
					}
				]
			});

			const marker = await (restClient ?? storage.client).createMarker(mapData.adminId, {
				lat: 0,
				lon: 0,
				typeId: type.id,
				data: {
					"Dropdown": "Value 1"
				}
			});

			const markerUpdate = await (restClient ?? storage.client).updateMarker(mapData.adminId, marker.id, {
				colour: "ffffff",
				size: 20,
				icon: "b",
				shape: "drop"
			});

			expect(markerUpdate).toMatchObject({
				colour: "00ffff",
				size: 60,
				icon: "z",
				shape: "rectangle",
			});
		});
	});

	test("Line update is overridden by dropdown styles", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);

		await createTemporaryMap(storage, { createDefaultTypes: false }, async (createMapData, mapData) => {
			const type = await (restClient ?? storage.client).createType(mapData.adminId, {
				name: "Test type",
				type: "line",
				fields: [
					{
						name: "Dropdown",
						type: "dropdown",
						controlColour: true,
						controlWidth: true,
						controlStroke: true,
						options: [
							{ value: "Value 1", colour: "00ffff", width: 11, stroke: "dashed" },
							{ value: "Value 2", colour: "00ff00", width: 10, stroke: "dotted" }
						],
						default: "Value 2"
					}
				]
			});

			const line = await (restClient ?? storage.client).createLine(mapData.adminId, {
				routePoints: [
					{ lat: 0, lon: 0 },
					{ lat: 1, lon: 1 }
				],
				typeId: type.id,
				data: {
					"Dropdown": "Value 1"
				}
			});

			const lineUpdate = await (restClient ?? storage.client).updateLine(mapData.adminId, line.id, {
				colour: "ffff00",
				width: 20,
				stroke: ""
			});

			expect(lineUpdate).toMatchObject({
				colour: "00ffff",
				width: 11,
				stroke: "dashed"
			});
		});
	});

	test("New dropdown styles are applied to existing markers", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);

		await createTemporaryMap(storage, { createDefaultTypes: false }, async (createMapData, mapData) => {
			const type = await (restClient ?? storage.client).createType(mapData.adminId, {
				name: "Test type",
				type: "marker"
			});

			await storage.client.setBbox({ top: 1, right: 1, bottom: -1, left: -1, zoom: 0 }); // To have marker in bbox

			const marker = await (restClient ?? storage.client).createMarker(mapData.adminId, {
				lat: 0,
				lon: 0,
				typeId: type.id,
				colour: "ffffff",
				size: 20,
				icon: "b",
				shape: "drop"
			});

			const onMarker = vi.fn();
			storage.client.on("marker", onMarker);

			await (restClient ?? storage.client).updateType(mapData.adminId, type.id, {
				fields: [
					{
						name: "Dropdown",
						type: "dropdown",
						controlColour: true,
						controlSize: true,
						controlIcon: true,
						controlShape: true,
						options: [
							{ value: "Value 1", colour: "00ffff", size: 60, icon: "z", shape: "rectangle" },
							{ value: "Value 2", colour: "00ff00", size: 50, icon: "a", shape: "circle" }
						],
						default: "Value 2"
					}
				]
			});

			expect(onMarker).toBeCalledTimes(1);

			expect(storage.maps[mapData.adminId].markers[marker.id]).toMatchObject({
				colour: "00ff00",
				size: 50,
				icon: "a",
				shape: "circle",
			});
		});
	});

	test("New dropdown styles are applied to existing lines", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);

		await createTemporaryMap(storage, { createDefaultTypes: false }, async (createMapData, mapData) => {
			const type = await (restClient ?? storage.client).createType(mapData.adminId, {
				name: "Test type",
				type: "line"
			});

			const line = await (restClient ?? storage.client).createLine(mapData.adminId, {
				routePoints: [
					{ lat: 0, lon: 0 },
					{ lat: 1, lon: 1 }
				],
				typeId: type.id,
				colour: "ffffff",
				width: 20,
				stroke: "dashed",
				mode: ""
			});

			const onLine = vi.fn();
			storage.client.on("line", onLine);

			await (restClient ?? storage.client).updateType(mapData.adminId, type.id, {
				fields: [
					{
						name: "Dropdown",
						type: "dropdown",
						controlColour: true,
						controlWidth: true,
						controlStroke: true,
						options: [
							{ value: "Value 1", colour: "00ffff", width: 11, stroke: "dashed" },
							{ value: "Value 2", colour: "00ff00", width: 10, stroke: "dotted" }
						],
						default: "Value 2"
					}
				]
			});

			expect(onLine).toBeCalledTimes(1);

			expect(storage.maps[mapData.adminId].lines[line.id]).toMatchObject({
				colour: "00ff00",
				width: 10,
				stroke: "dotted"
			});
		});
	});

});