import { expect, test, vi } from "vitest";
import { createTemporaryMapV2, openClientV2 } from "../../utils";
import { SocketVersion } from "facilmap-types";

test("New marker is created with default settings", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, { createDefaultTypes: false }, async () => {
		const type = await client.addType({
			name: "Test type",
			type: "marker",
			defaultColour: "00ff00",
			defaultSize: 50,
			defaultSymbol: "a",
			defaultShape: "circle"
		});

		const marker = await client.addMarker({
			lat: 0,
			lon: 0,
			typeId: type.id
		});

		expect(marker).toMatchObject({
			colour: "00ff00",
			size: 50,
			symbol: "a",
			shape: "circle",
		});
	});
});

test("New line is created with default settings", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, { createDefaultTypes: false }, async () => {
		const type = await client.addType({
			name: "Test type",
			type: "line",
			defaultColour: "00ff00",
			defaultWidth: 10,
			defaultStroke: "dotted",
			defaultMode: "straight",
		});

		const line = await client.addLine({
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

test("Line template uses default settings", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, { createDefaultTypes: false }, async () => {
		const type = await client.addType({
			name: "Test type",
			type: "line",
			defaultColour: "00ff00",
			defaultWidth: 10,
			defaultStroke: "dotted",
			defaultMode: "straight",
		});

		const lineTemplate = await client.getLineTemplate({
			typeId: type.id
		});

		expect(lineTemplate).toEqual({
			typeId: type.id,
			name: "",
			colour: "00ff00",
			width: 10,
			stroke: "dotted",
			mode: "straight",
			data: {}
		});
	});
});

test("New marker is created with fixed settings", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, { createDefaultTypes: false }, async () => {
		const type = await client.addType({
			name: "Test type",
			type: "marker",
			defaultColour: "00ff00",
			colourFixed: true,
			defaultSize: 50,
			sizeFixed: true,
			defaultSymbol: "a",
			symbolFixed: true,
			defaultShape: "circle",
			shapeFixed: true
		});

		const marker = await client.addMarker({
			lat: 0,
			lon: 0,
			typeId: type.id,
			colour: "ffffff",
			size: 20,
			symbol: "b",
			shape: "drop"
		});

		expect(marker).toMatchObject({
			colour: "00ff00",
			size: 50,
			symbol: "a",
			shape: "circle",
		});
	});
});

test("New line is created with fixed settings", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, { createDefaultTypes: false }, async () => {
		const type = await client.addType({
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

		const line = await client.addLine({
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
	const client = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, { createDefaultTypes: false }, async () => {
		const type = await client.addType({
			name: "Test type",
			type: "marker",
			defaultColour: "00ff00",
			colourFixed: true,
			defaultSize: 50,
			sizeFixed: true,
			defaultSymbol: "a",
			symbolFixed: true,
			defaultShape: "circle",
			shapeFixed: true
		});

		const marker = await client.addMarker({
			lat: 0,
			lon: 0,
			typeId: type.id
		});

		const markerUpdate = await client.editMarker({
			id: marker.id,
			colour: "ffffff",
			size: 20,
			symbol: "b",
			shape: "drop"
		});

		expect(markerUpdate).toMatchObject({
			colour: "00ff00",
			size: 50,
			symbol: "a",
			shape: "circle",
		});
	});
});

test("Line is overridden by fixed settings", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, { createDefaultTypes: false }, async () => {
		const type = await client.addType({
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

		const line = await client.addLine({
			routePoints: [
				{ lat: 0, lon: 0 },
				{ lat: 1, lon: 1 }
			],
			typeId: type.id
		});

		const lineUpdate = await client.editLine({
			id: line.id,
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
	const client = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, { createDefaultTypes: false }, async () => {
		const type = await client.addType({
			name: "Test type",
			type: "marker"
		});

		await client.updateBbox({ top: 1, right: 1, bottom: -1, left: -1, zoom: 0 }); // To have marker in bbox

		const marker = await client.addMarker({
			lat: 0,
			lon: 0,
			typeId: type.id,
			colour: "ffffff",
			size: 20,
			symbol: "b",
			shape: "drop"
		});

		const onMarker = vi.fn();
		client.on("marker", onMarker);

		await client.editType({
			id: type.id,
			defaultColour: "00ff00",
			colourFixed: true,
			defaultSize: 50,
			sizeFixed: true,
			defaultSymbol: "a",
			symbolFixed: true,
			defaultShape: "circle",
			shapeFixed: true
		});

		expect(onMarker).toBeCalledTimes(1);

		expect(client.markers[marker.id]).toMatchObject({
			colour: "00ff00",
			size: 50,
			symbol: "a",
			shape: "circle",
		});
	});
});

test("New fixed line styles are applied to existing lines", async () => {
	const client = await openClientV2(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, { createDefaultTypes: false }, async () => {
		const type = await client.addType({
			name: "Test type",
			type: "line"
		});

		const line = await client.addLine({
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
		client.on("line", onLine);

		await client.editType({
			id: type.id,
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

		expect(client.lines[line.id]).toMatchObject({
			colour: "00ff00",
			width: 10,
			stroke: "dotted",
			mode: "straight"
		});
	});
});
