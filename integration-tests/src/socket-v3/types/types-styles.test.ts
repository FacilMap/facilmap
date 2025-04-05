import { expect, test, vi } from "vitest";
import { createTemporaryMap, openClientStorage } from "../../utils";

test("New marker is created with default settings", async () => {
	const storage = await openClientStorage();

	await createTemporaryMap(storage, { createDefaultTypes: false }, async (createMapData, mapData) => {
		const type = await storage.client.createType(mapData.adminId, {
			name: "Test type",
			type: "marker",
			defaultColour: "00ff00",
			defaultSize: 50,
			defaultIcon: "a",
			defaultShape: "circle"
		});

		const marker = await storage.client.createMarker(mapData.adminId, {
			lat: 0,
			lon: 0,
			typeId: type.id
		});

		expect(marker).toMatchObject({
			colour: "00ff00",
			size: 50,
			icon: "a",
			shape: "circle",
		});
	});
});

test("New line is created with default settings", async () => {
	const storage = await openClientStorage();

	await createTemporaryMap(storage, { createDefaultTypes: false }, async (createMapData, mapData) => {
		const type = await storage.client.createType(mapData.adminId, {
			name: "Test type",
			type: "line",
			defaultColour: "00ff00",
			defaultWidth: 10,
			defaultStroke: "dotted",
			defaultMode: "straight",
		});

		const line = await storage.client.createLine(mapData.adminId, {
			routePoints: [
				{ lat: 0, lon: 0 },
				{ lat: 1, lon: 1 }
			],
			typeId: type.id
		});

		expect(line).toMatchObject({
			colour: "00ff00",
			width: 10,
			stroke: "dotted",
			mode: "straight"
		});
	});
});

test("New marker is created with fixed settings", async () => {
	const storage = await openClientStorage();

	await createTemporaryMap(storage, { createDefaultTypes: false }, async (createMapData, mapData) => {
		const type = await storage.client.createType(mapData.adminId, {
			name: "Test type",
			type: "marker",
			defaultColour: "00ff00",
			colourFixed: true,
			defaultSize: 50,
			sizeFixed: true,
			defaultIcon: "a",
			iconFixed: true,
			defaultShape: "circle",
			shapeFixed: true
		});

		const marker = await storage.client.createMarker(mapData.adminId, {
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

test("New line is created with fixed settings", async () => {
	const storage = await openClientStorage();

	await createTemporaryMap(storage, { createDefaultTypes: false }, async (createMapData, mapData) => {
		const type = await storage.client.createType(mapData.adminId, {
			name: "Test type",
			type: "line",
			defaultColour: "00ff00",
			colourFixed: true,
			defaultWidth: 10,
			widthFixed: true,
			defaultStroke: "dotted",
			strokeFixed: true,
			defaultMode: "straight",
			modeFixed: true
		});

		const line = await storage.client.createLine(mapData.adminId, {
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

		expect(line).toMatchObject({
			colour: "00ff00",
			width: 10,
			stroke: "dotted",
			mode: "straight"
		});
	});
});

test("Marker update is overridden by fixed settings", async () => {
	const storage = await openClientStorage();

	await createTemporaryMap(storage, { createDefaultTypes: false }, async (createMapData, mapData) => {
		const type = await storage.client.createType(mapData.adminId, {
			name: "Test type",
			type: "marker",
			defaultColour: "00ff00",
			colourFixed: true,
			defaultSize: 50,
			sizeFixed: true,
			defaultIcon: "a",
			iconFixed: true,
			defaultShape: "circle",
			shapeFixed: true
		});

		const marker = await storage.client.createMarker(mapData.adminId, {
			lat: 0,
			lon: 0,
			typeId: type.id
		});

		const markerUpdate = await storage.client.updateMarker(mapData.adminId, marker.id, {
			colour: "ffffff",
			size: 20,
			icon: "b",
			shape: "drop"
		});

		expect(markerUpdate).toMatchObject({
			colour: "00ff00",
			size: 50,
			icon: "a",
			shape: "circle",
		});
	});
});

test("Line is overridden by fixed settings", async () => {
	const storage = await openClientStorage();

	await createTemporaryMap(storage, { createDefaultTypes: false }, async (createMapData, mapData) => {
		const type = await storage.client.createType(mapData.adminId, {
			name: "Test type",
			type: "line",
			defaultColour: "00ff00",
			colourFixed: true,
			defaultWidth: 10,
			widthFixed: true,
			defaultStroke: "dotted",
			strokeFixed: true,
			defaultMode: "straight",
			modeFixed: true
		});

		const line = await storage.client.createLine(mapData.adminId, {
			routePoints: [
				{ lat: 0, lon: 0 },
				{ lat: 1, lon: 1 }
			],
			typeId: type.id
		});

		const lineUpdate = await storage.client.updateLine(mapData.adminId, line.id, {
			colour: "ffffff",
			width: 20,
			stroke: "dashed",
			mode: ""
		});

		expect(lineUpdate).toMatchObject({
			colour: "00ff00",
			width: 10,
			stroke: "dotted",
			mode: "straight"
		});
	});
});

test("New fixed marker styles are applied to existing markers", async () => {
	const storage = await openClientStorage();

	await createTemporaryMap(storage, { createDefaultTypes: false }, async (createMapData, mapData) => {
		const type = await storage.client.createType(mapData.adminId, {
			name: "Test type",
			type: "marker"
		});

		await storage.client.setBbox({ top: 1, right: 1, bottom: -1, left: -1, zoom: 0 }); // To have marker in bbox

		const marker = await storage.client.createMarker(mapData.adminId, {
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

		await storage.client.updateType(mapData.adminId, type.id, {
			defaultColour: "00ff00",
			colourFixed: true,
			defaultSize: 50,
			sizeFixed: true,
			defaultIcon: "a",
			iconFixed: true,
			defaultShape: "circle",
			shapeFixed: true
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

test("New fixed line styles are applied to existing lines", async () => {
	const storage = await openClientStorage();

	await createTemporaryMap(storage, { createDefaultTypes: false }, async (createMapData, mapData) => {
		const type = await storage.client.createType(mapData.adminId, {
			name: "Test type",
			type: "line"
		});

		const line = await storage.client.createLine(mapData.adminId, {
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

		await storage.client.updateType(mapData.adminId, type.id, {
			defaultColour: "00ff00",
			colourFixed: true,
			defaultWidth: 10,
			widthFixed: true,
			defaultStroke: "dotted",
			strokeFixed: true,
			defaultMode: "straight",
			modeFixed: true
		});

		expect(onLine).toBeCalledTimes(1);

		expect(storage.maps[mapData.adminId].lines[line.id]).toMatchObject({
			colour: "00ff00",
			width: 10,
			stroke: "dotted",
			mode: "straight"
		});
	});
});
