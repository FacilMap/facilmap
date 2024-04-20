import { expect, test, vi } from "vitest";
import { createTemporaryMap, openClient, retry } from "../utils";
import { CRU, type Line, type LinePointsEvent, type FindOnMapLine, type ID } from "facilmap-types";
import type { LineWithTrackPoints } from "facilmap-client";
import { cloneDeep, omit } from "lodash-es";

test("Create line (using default values)", async () => {
	// client1: Creates the line and has it in its bbox
	// client2: Has the line in its bbox
	// client3: Does not have the line in its bbox

	const client1 = await openClient();

	await createTemporaryMap(client1, {}, async (createMapData, mapData) => {
		const client2 = await openClient(mapData.id);
		const client3 = await openClient(mapData.id);

		const onLine1 = vi.fn();
		client1.on("line", onLine1);
		const onLinePoints1 = vi.fn();
		client1.on("linePoints", onLinePoints1);
		const onLine2 = vi.fn();
		client2.on("line", onLine2);
		const onLinePoints2 = vi.fn();
		client2.on("linePoints", onLinePoints2);
		const onLine3 = vi.fn();
		client3.on("line", onLine3);
		const onLinePoints3 = vi.fn();
		client3.on("linePoints", onLinePoints3);

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
			name: "",
			mode: "",
			colour: "0000ff",
			width: 4,
			stroke: "",
			data: {},
			top: 14,
			right: 14,
			bottom: 6,
			left: 6,
			distance: 1247.95,
			ascent: null,
			descent: null,
			time: null,
			extraInfo: null
		} satisfies Line;

		const expectedLinePointsEvent = {
			id: line.id,
			trackPoints: [
				{ lat: 6, lon: 6, idx: 0, zoom: 1, ele: null },
				{ lat: 14, lon: 14, idx: 1, zoom: 1, ele: null }
			],
			reset: true
		} satisfies LinePointsEvent;

		const expectedLineWithEmptyTrackPoints = {
			...expectedLine,
			trackPoints: {
				length: 0
			}
		} satisfies LineWithTrackPoints;

		const expectedLineWithTrackPoints = {
			...expectedLine,
			trackPoints: {
				0: { lat: 6, lon: 6, idx: 0, zoom: 1, ele: null },
				1: { lat: 14, lon: 14, idx: 1, zoom: 1, ele: null },
				length: 2
			}
		} satisfies LineWithTrackPoints;

		expect(line).toEqual(expectedLine);

		await retry(() => {
			expect(onLine1).toHaveBeenCalledTimes(1);
			expect(onLinePoints1).toHaveBeenCalledTimes(1);
			expect(onLine2).toHaveBeenCalledTimes(1);
			expect(onLinePoints2).toHaveBeenCalledTimes(1);
			expect(onLine3).toHaveBeenCalledTimes(1);
			expect(onLinePoints3).toHaveBeenCalledTimes(1);
		});

		expect(onLine1).toHaveBeenCalledWith(expectedLine);
		expect(onLinePoints1).toHaveBeenCalledWith(expectedLinePointsEvent);
		expect(onLine2).toHaveBeenCalledWith(expectedLine);
		expect(onLine3).toHaveBeenCalledWith(expectedLine);

		expect(cloneDeep(client1.lines)).toEqual({ [expectedLine.id]: expectedLineWithTrackPoints });
		expect(cloneDeep(client2.lines)).toEqual({ [expectedLine.id]: expectedLineWithTrackPoints });
		expect(cloneDeep(client3.lines)).toEqual({ [expectedLine.id]: expectedLineWithEmptyTrackPoints });
	});
});

test("Create line (using custom values)", async () => {
	const client = await openClient();
	await client.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });

	await createTemporaryMap(client, {}, async (createMapData, mapData) => {
		const lineType = Object.values(client.types).find((t) => t.type === "line")!;

		const data: Line<CRU.CREATE> = {
			routePoints: [
				{ lat: 6, lon: 6 },
				{ lat: 12, lon: 12 }
			],
			typeId: lineType.id,
			name: "Test line",
			mode: "track",
			colour: "00ff00",
			width: 10,
			stroke: "dotted",
			data: {
				test: "value"
			},
			trackPoints: [
				{ lat: 6, lon: 6 },
				{ lat: 14, lon: 14 },
				{ lat: 12, lon: 12 }
			]
		};

		const line = await client.addLine(data);

		const expectedLine = {
			id: line.id,
			padId: mapData.id,
			...omit(data, ["trackPoints"]),
			top: 14,
			right: 14,
			bottom: 6,
			left: 6,
			distance: 1558.44,
			time: null,
			ascent: null,
			descent: null,
			extraInfo: null
		};

		const expectedLineWithTrackPoints = {
			...expectedLine,
			trackPoints: {
				0: { lat: 6, lon: 6, idx: 0, zoom: 1, ele: null },
				1: { lat: 14, lon: 14, idx: 1, zoom: 1, ele: null },
				2: { lat: 12, lon: 12, idx: 2, zoom: 1, ele: null },
				length: 3
			}
		};

		expect(line).toEqual(expectedLine);
		await retry(() => {
			expect(cloneDeep(client.lines)).toEqual({
				[expectedLine.id]: expectedLineWithTrackPoints
			});
		});
	});
});

test("Edit line", async () => {
	// client1: Creates the line and has it in its bbox
	// client2: Has the line in its bbox
	// client3: Does not have the line in its bbox

	const client1 = await openClient();

	await createTemporaryMap(client1, {}, async (createMapData, mapData) => {
		const client2 = await openClient(mapData.id);
		const client3 = await openClient(mapData.id);

		const lineType = Object.values(client1.types).find((t) => t.type === "line")!;

		await client1.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await client2.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await client3.updateBbox({ top: 5, bottom: 0, left: 0, right: 5, zoom: 1 });

		const createdLine = await client1.addLine({
			routePoints: [
				{ lat: 6, lon: 6 },
				{ lat: 14, lon: 14 }
			],
			typeId: lineType.id
		});

		const secondType = await client1.addType({
			type: "line",
			name: "Second type"
		});

		const onLine1 = vi.fn();
		client1.on("line", onLine1);
		const onLinePoints1 = vi.fn();
		client1.on("linePoints", onLinePoints1);
		const onLine2 = vi.fn();
		client2.on("line", onLine2);
		const onLinePoints2 = vi.fn();
		client2.on("linePoints", onLinePoints2);
		const onLine3 = vi.fn();
		client3.on("line", onLine3);
		const onLinePoints3 = vi.fn();
		client3.on("linePoints", onLinePoints3);

		const newData = {
			id: createdLine.id,
			routePoints: [
				{ lat: 6, lon: 6 },
				{ lat: 12, lon: 12 }
			],
			typeId: secondType.id,
			name: "Test line",
			mode: "track",
			colour: "00ff00",
			width: 10,
			stroke: "dotted" as const,
			data: {
				test: "value"
			},
			trackPoints: [
				{ lat: 6, lon: 6 },
				{ lat: 14, lon: 14 },
				{ lat: 12, lon: 12 }
			]
		} satisfies Line<CRU.UPDATE> & { id: ID };
		const line = await client1.editLine(newData);

		const expectedLine = {
			padId: mapData.id,
			...omit(newData, ["trackPoints"]),
			top: 14,
			right: 14,
			bottom: 6,
			left: 6,
			distance: 1558.44,
			time: null,
			ascent: null,
			descent: null,
			extraInfo: null
		} satisfies Line;

		const expectedLinePointsEvent = {
			id: line.id,
			trackPoints: [
				{ lat: 6, lon: 6, idx: 0, zoom: 1, ele: null },
				{ lat: 14, lon: 14, idx: 1, zoom: 1, ele: null },
				{ lat: 12, lon: 12, idx: 2, zoom: 1, ele: null }
			],
			reset: true
		} satisfies LinePointsEvent;

		const expectedLineWithEmptyTrackPoints = {
			...expectedLine,
			trackPoints: {
				length: 0
			}
		} satisfies LineWithTrackPoints;

		const expectedLineWithTrackPoints = {
			...expectedLine,
			trackPoints: {
				0: { lat: 6, lon: 6, idx: 0, zoom: 1, ele: null },
				1: { lat: 14, lon: 14, idx: 1, zoom: 1, ele: null },
				2: { lat: 12, lon: 12, idx: 2, zoom: 1, ele: null },
				length: 3
			}
		};

		expect(line).toEqual(expectedLine);

		await retry(() => {
			expect(onLine1).toHaveBeenCalledTimes(1);
			expect(onLinePoints1).toHaveBeenCalledTimes(1);
			expect(onLine2).toHaveBeenCalledTimes(1);
			expect(onLinePoints2).toHaveBeenCalledTimes(1);
			expect(onLine3).toHaveBeenCalledTimes(1);
			expect(onLinePoints3).toHaveBeenCalledTimes(1);
		});

		expect(onLine1).toHaveBeenCalledWith(expectedLine);
		expect(onLinePoints1).toHaveBeenCalledWith(expectedLinePointsEvent);
		expect(onLine2).toHaveBeenCalledWith(expectedLine);
		expect(onLine3).toHaveBeenCalledWith(expectedLine);

		expect(cloneDeep(client1.lines)).toEqual({ [expectedLine.id]: expectedLineWithTrackPoints });
		expect(cloneDeep(client2.lines)).toEqual({ [expectedLine.id]: expectedLineWithTrackPoints });
		expect(cloneDeep(client3.lines)).toEqual({ [expectedLine.id]: expectedLineWithEmptyTrackPoints });
	});
});

test("Delete line", async () => {
	// client1: Creates the line and has it in its bbox
	// client2: Has the line in its bbox
	// client3: Does not have the line in its bbox

	const client1 = await openClient();

	await createTemporaryMap(client1, {}, async (createMapData, mapData) => {
		const client2 = await openClient(mapData.id);
		const client3 = await openClient(mapData.id);

		const lineType = Object.values(client1.types).find((t) => t.type === "line")!;

		await client1.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await client2.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await client3.updateBbox({ top: 5, bottom: 0, left: 0, right: 5, zoom: 1 });

		const createdLine = await client1.addLine({
			routePoints: [
				{ lat: 6, lon: 6 },
				{ lat: 14, lon: 14 }
			],
			typeId: lineType.id
		});

		const onDeleteLine1 = vi.fn();
		client1.on("deleteLine", onDeleteLine1);
		const onDeleteLine2 = vi.fn();
		client2.on("deleteLine", onDeleteLine2);
		const onDeleteLine3 = vi.fn();
		client3.on("deleteLine", onDeleteLine3);

		const deletedLine = await client1.deleteLine({ id: createdLine.id });

		expect(deletedLine).toEqual(createdLine);

		await retry(() => {
			expect(onDeleteLine1).toHaveBeenCalledTimes(1);
			expect(onDeleteLine2).toHaveBeenCalledTimes(1);
			expect(onDeleteLine3).toHaveBeenCalledTimes(1);
		});

		expect(onDeleteLine1).toHaveBeenCalledWith({ id: deletedLine.id });
		expect(onDeleteLine2).toHaveBeenCalledWith({ id: deletedLine.id });
		expect(onDeleteLine3).toHaveBeenCalledWith({ id: deletedLine.id });

		const expectedLineRecord = { };
		expect(cloneDeep(client1.lines)).toEqual(expectedLineRecord);
		expect(cloneDeep(client2.lines)).toEqual(expectedLineRecord);
		expect(cloneDeep(client3.lines)).toEqual(expectedLineRecord);
	});
});

test("Find line", async () => {
	const client1 = await openClient();

	await createTemporaryMap(client1, {}, async (createMapData, mapData) => {
		const client2 = await openClient(mapData.id);

		const lineType = Object.values(client1.types).find((t) => t.type === "line")!;

		const marker = await client1.addLine({
			name: "Line test",
			routePoints: [
				{ lat: 6, lon: 6 },
				{ lat: 14, lon: 14 }
			],
			typeId: lineType.id
		});

		const expectedResult: FindOnMapLine = {
			id: marker.id,
			kind: "line",
			similarity: 1,
			typeId: lineType.id,
			name: "Line test",
			top: 14,
			right: 14,
			bottom: 6,
			left: 6
		};

		expect(await client2.findOnMap({ query: "Test" })).toEqual([{ ...expectedResult, similarity: 0.4 }]);
		expect(await client2.findOnMap({ query: "T_st" })).toEqual([{ ...expectedResult, similarity: 0.2 }]);
		expect(await client2.findOnMap({ query: "L%e" })).toEqual([{ ...expectedResult, similarity: 0 }]);
		expect(await client2.findOnMap({ query: "Bla" })).toEqual([]);
	});
});

test("Try to create line with marker type", async () => {
	const client = await openClient();

	await createTemporaryMap(client, {}, async (createMapData) => {
		const lineType = Object.values(client.types).find((t) => t.type === "marker")!;

		await expect(async () => {
			await client.addLine({
				routePoints: [
					{ lat: 6, lon: 6 },
					{ lat: 14, lon: 14 }
				],
				typeId: lineType.id
			});
		}).rejects.toThrowError("Cannot use marker type for line");

		const client3 = await openClient(createMapData.adminId);
		await client3.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		expect(cloneDeep(client3.lines)).toEqual({});
	});
});

test("Try to update line with line type", async () => {
	const client = await openClient();

	await createTemporaryMap(client, {}, async (createMapData) => {
		const markerType = Object.values(client.types).find((t) => t.type === "marker")!;
		const lineType = Object.values(client.types).find((t) => t.type === "line")!;

		const line = await client.addLine({
			routePoints: [
				{ lat: 6, lon: 6 },
				{ lat: 14, lon: 14 }
			],
			typeId: lineType.id
		});

		await expect(async () => {
			await client.editLine({
				id: line.id,
				typeId: markerType.id
			});
		}).rejects.toThrowError("Cannot use marker type for line");

		const client3 = await openClient(createMapData.adminId);
		expect(cloneDeep(client3.lines)).toEqual({
			[line.id]: {
				...line,
				trackPoints: {
					length: 0
				}
			}
		});
	});
});

test("Try to create line with line type from other map", async () => {
	const client1 = await openClient();
	const client2 = await openClient();

	await createTemporaryMap(client1, {}, async (createMapData) => {
		await createTemporaryMap(client2, {}, async () => {
			const lineType2 = Object.values(client2.types).find((t) => t.type === "line")!;

			await expect(async () => {
				await client1.addLine({
					routePoints: [
						{ lat: 6, lon: 6 },
						{ lat: 14, lon: 14 }
					],
					typeId: lineType2.id
				});
			}).rejects.toThrowError("could not be found");

			const client3 = await openClient(createMapData.adminId);
			await client3.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
			expect(cloneDeep(client3.lines)).toEqual({});
		});
	});
});

test("Try to update line with line type from other map", async () => {
	const client1 = await openClient();
	const client2 = await openClient();

	await createTemporaryMap(client1, {}, async (createMapData) => {
		await createTemporaryMap(client2, {}, async () => {
			const lineType1 = Object.values(client1.types).find((t) => t.type === "line")!;
			const lineType2 = Object.values(client2.types).find((t) => t.type === "line")!;

			const line = await client1.addLine({
				routePoints: [
					{ lat: 6, lon: 6 },
					{ lat: 14, lon: 14 }
				],
				typeId: lineType1.id
			});

			await expect(async () => {
				await client1.editLine({
					id: line.id,
					typeId: lineType2.id
				});
			}).rejects.toThrowError("could not be found");

			const client3 = await openClient(createMapData.adminId);
			await client3.updateBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
			expect(cloneDeep(client3.lines)).toEqual({
				[line.id]: {
					...line,
					trackPoints: {
						0: { lat: 6, lon: 6, idx: 0, zoom: 1, ele: null },
						1: { lat: 14, lon: 14, idx: 1, zoom: 1, ele: null },
						length: 2
					}
				}
			});
		});
	});
});

test("Export line", async () => {
	const client = await openClient();

	await createTemporaryMap(client, {}, async (createMapData, mapData) => {
		const lineType = Object.values(client.types).find((t) => t.type === "line")!;

		const line = await client.addLine({
			routePoints: [
				{ lat: 6, lon: 6 },
				{ lat: 14, lon: 14 }
			],
			typeId: lineType.id
		});

		expect((await client.exportLine({ id: line.id, format: "gpx-trk" })).replace(/<time>[^<]*<\/time>/, "<time></time>")).toEqual(
`<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" creator="FacilMap" version="1.1" xmlns:osmand="https://osmand.net" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
	<metadata>
		<time></time>
		<name>Untitled line</name>
		<extensions>
			<osmand:desc></osmand:desc>
		</extensions>
	</metadata>
	<extensions>
		<osmand:color>#aa0000ff</osmand:color>
		<osmand:width>4</osmand:width>
	</extensions>
	<trk>
		<name>Untitled line</name>
		<desc></desc>
		<trkseg>
			<trkpt lat="6" lon="6" />
			<trkpt lat="14" lon="14" />
		</trkseg>
	</trk>
</gpx>`);

		expect((await client.exportLine({ id: line.id, format: "gpx-rte" })).replace(/<time>[^<]*<\/time>/, "<time></time>")).toEqual(
`<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" creator="FacilMap" version="1.1" xmlns:osmand="https://osmand.net" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
	<metadata>
		<time></time>
		<name>Untitled line</name>
		<extensions>
			<osmand:desc></osmand:desc>
		</extensions>
	</metadata>
	<extensions>
		<osmand:color>#aa0000ff</osmand:color>
		<osmand:width>4</osmand:width>
	</extensions>
	<rte>
		<name>Untitled line</name>
		<desc></desc>
		<rtept lat="6" lon="6" />
		<rtept lat="14" lon="14" />
	</rte>
</gpx>`);
	});
});

test("Export line (track)", async () => {
	const client = await openClient();

	await createTemporaryMap(client, {}, async (createMapData, mapData) => {
		const lineType = Object.values(client.types).find((t) => t.type === "line")!;

		const line = await client.addLine({
			routePoints: [
				{ lat: 6, lon: 6 },
				{ lat: 12, lon: 12 }
			],
			typeId: lineType.id,
			name: "Test line",
			mode: "track",
			colour: "00ff00",
			width: 10,
			stroke: "dotted",
			data: {
				test: "value"
			},
			trackPoints: [
				{ lat: 6, lon: 6 },
				{ lat: 14, lon: 14 },
				{ lat: 12, lon: 12 }
			]
		});

		expect((await client.exportLine({ id: line.id, format: "gpx-trk" })).replace(/<time>[^<]*<\/time>/, "<time></time>")).toEqual(
`<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" creator="FacilMap" version="1.1" xmlns:osmand="https://osmand.net" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
	<metadata>
		<time></time>
		<name>Test line</name>
		<extensions>
			<osmand:desc></osmand:desc>
		</extensions>
	</metadata>
	<extensions>
		<osmand:color>#aa00ff00</osmand:color>
		<osmand:width>10</osmand:width>
	</extensions>
	<trk>
		<name>Test line</name>
		<desc></desc>
		<trkseg>
			<trkpt lat="6" lon="6" />
			<trkpt lat="14" lon="14" />
			<trkpt lat="12" lon="12" />
		</trkseg>
	</trk>
</gpx>`);

		expect((await client.exportLine({ id: line.id, format: "gpx-rte" })).replace(/<time>[^<]*<\/time>/, "<time></time>")).toEqual(
`<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" creator="FacilMap" version="1.1" xmlns:osmand="https://osmand.net" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
	<metadata>
		<time></time>
		<name>Test line</name>
		<extensions>
			<osmand:desc></osmand:desc>
		</extensions>
	</metadata>
	<extensions>
		<osmand:color>#aa00ff00</osmand:color>
		<osmand:width>10</osmand:width>
	</extensions>
	<rte>
		<name>Test line</name>
		<desc></desc>
		<rtept lat="6" lon="6" />
		<rtept lat="12" lon="12" />
	</rte>
</gpx>`);
	});
});