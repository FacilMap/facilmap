import { expect, test, vi } from "vitest";
import { createTemporaryMap, openClientStorage, retry } from "../utils";
import { CRU, type Line, type FindOnMapLine, type LineWithTrackPoints, type LinePoints } from "facilmap-types";
import { cloneDeep, omit } from "lodash-es";

test("Create line (using default values)", async () => {
	// storage1: Creates the line and has it in its bbox
	// storage2: Has the line in its bbox
	// storage3: Does not have the line in its bbox

	const storage1 = await openClientStorage();

	await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
		const storage2 = await openClientStorage(mapData.readId);
		const storage3 = await openClientStorage(mapData.readId);

		const onLine1 = vi.fn();
		storage1.client.on("line", onLine1);
		const onLinePoints1 = vi.fn();
		storage1.client.on("linePoints", onLinePoints1);
		const onLine2 = vi.fn();
		storage2.client.on("line", onLine2);
		const onLinePoints2 = vi.fn();
		storage2.client.on("linePoints", onLinePoints2);
		const onLine3 = vi.fn();
		storage3.client.on("line", onLine3);
		const onLinePoints3 = vi.fn();
		storage3.client.on("linePoints", onLinePoints3);

		const lineType = Object.values(storage1.maps[mapData.adminId].types).find((t) => t.type === "line")!;

		await storage1.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await storage2.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await storage3.client.setBbox({ top: 5, bottom: 0, left: 0, right: 5, zoom: 1 });

		const line = await storage1.client.createLine(mapData.adminId, {
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
			mapId: mapData.id,
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
			lineId: line.id,
			trackPoints: [
				{ lat: 6, lon: 6, idx: 0, zoom: 1, ele: null },
				{ lat: 14, lon: 14, idx: 1, zoom: 1, ele: null }
			],
			reset: true
		} satisfies LinePoints & { reset: boolean };

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

		expect(onLine1).toHaveBeenCalledWith(mapData.adminId, expectedLine);
		expect(onLinePoints1).toHaveBeenCalledWith(mapData.adminId, expectedLinePointsEvent);
		expect(onLine2).toHaveBeenCalledWith(mapData.readId, expectedLine);
		expect(onLine3).toHaveBeenCalledWith(mapData.readId, expectedLine);

		expect(cloneDeep(storage1.maps[mapData.adminId].lines)).toEqual({ [expectedLine.id]: expectedLineWithTrackPoints });
		expect(cloneDeep(storage2.maps[mapData.readId].lines)).toEqual({ [expectedLine.id]: expectedLineWithTrackPoints });
		expect(cloneDeep(storage3.maps[mapData.readId].lines)).toEqual({ [expectedLine.id]: expectedLineWithEmptyTrackPoints });
	});
});

test("Create line (using custom values)", async () => {
	const storage = await openClientStorage();
	await storage.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });

	await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
		const lineType = Object.values(storage.maps[mapData.adminId].types).find((t) => t.type === "line")!;

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

		const line = await storage.client.createLine(mapData.adminId, data);

		const expectedLine = {
			id: line.id,
			mapId: mapData.id,
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
			expect(cloneDeep(storage.maps[mapData.adminId].lines)).toEqual({
				[expectedLine.id]: expectedLineWithTrackPoints
			});
		});
	});
});

test("Edit line", async () => {
	// storage1: Creates the line and has it in its bbox
	// storage2: Has the line in its bbox
	// storage3: Does not have the line in its bbox

	const storage1 = await openClientStorage();

	await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
		const storage2 = await openClientStorage(mapData.readId);
		const storage3 = await openClientStorage(mapData.readId);

		const lineType = Object.values(storage1.maps[mapData.adminId].types).find((t) => t.type === "line")!;

		await storage1.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await storage2.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await storage3.client.setBbox({ top: 5, bottom: 0, left: 0, right: 5, zoom: 1 });

		const createdLine = await storage1.client.createLine(mapData.adminId, {
			routePoints: [
				{ lat: 6, lon: 6 },
				{ lat: 14, lon: 14 }
			],
			typeId: lineType.id
		});

		const secondType = await storage1.client.createType(mapData.adminId, {
			type: "line",
			name: "Second type"
		});

		const onLine1 = vi.fn();
		storage1.client.on("line", onLine1);
		const onLinePoints1 = vi.fn();
		storage1.client.on("linePoints", onLinePoints1);
		const onLine2 = vi.fn();
		storage2.client.on("line", onLine2);
		const onLinePoints2 = vi.fn();
		storage2.client.on("linePoints", onLinePoints2);
		const onLine3 = vi.fn();
		storage3.client.on("line", onLine3);
		const onLinePoints3 = vi.fn();
		storage3.client.on("linePoints", onLinePoints3);

		const newData = {
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
		} satisfies Line<CRU.UPDATE>;
		const line = await storage1.client.updateLine(mapData.adminId, createdLine.id, newData);

		const expectedLine = {
			id: createdLine.id,
			mapId: mapData.id,
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
			lineId: line.id,
			trackPoints: [
				{ lat: 6, lon: 6, idx: 0, zoom: 1, ele: null },
				{ lat: 14, lon: 14, idx: 1, zoom: 1, ele: null },
				{ lat: 12, lon: 12, idx: 2, zoom: 1, ele: null }
			],
			reset: true
		} satisfies LinePoints & { reset: boolean };

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

		expect(onLine1).toHaveBeenCalledWith(mapData.adminId, expectedLine);
		expect(onLinePoints1).toHaveBeenCalledWith(mapData.adminId, expectedLinePointsEvent);
		expect(onLine2).toHaveBeenCalledWith(mapData.readId, expectedLine);
		expect(onLine3).toHaveBeenCalledWith(mapData.readId, expectedLine);

		expect(cloneDeep(storage1.maps[mapData.adminId].lines)).toEqual({ [expectedLine.id]: expectedLineWithTrackPoints });
		expect(cloneDeep(storage2.maps[mapData.readId].lines)).toEqual({ [expectedLine.id]: expectedLineWithTrackPoints });
		expect(cloneDeep(storage3.maps[mapData.readId].lines)).toEqual({ [expectedLine.id]: expectedLineWithEmptyTrackPoints });
	});
});

test("Delete line", async () => {
	// storage1: Creates the line and has it in its bbox
	// storage2: Has the line in its bbox
	// storage3: Does not have the line in its bbox

	const storage1 = await openClientStorage();

	await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
		const storage2 = await openClientStorage(mapData.readId);
		const storage3 = await openClientStorage(mapData.readId);

		const lineType = Object.values(storage1.maps[mapData.adminId].types).find((t) => t.type === "line")!;

		await storage1.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await storage2.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		await storage3.client.setBbox({ top: 5, bottom: 0, left: 0, right: 5, zoom: 1 });

		const createdLine = await storage1.client.createLine(mapData.adminId, {
			routePoints: [
				{ lat: 6, lon: 6 },
				{ lat: 14, lon: 14 }
			],
			typeId: lineType.id
		});

		const onDeleteLine1 = vi.fn();
		storage1.client.on("deleteLine", onDeleteLine1);
		const onDeleteLine2 = vi.fn();
		storage2.client.on("deleteLine", onDeleteLine2);
		const onDeleteLine3 = vi.fn();
		storage3.client.on("deleteLine", onDeleteLine3);

		await storage1.client.deleteLine(mapData.adminId, createdLine.id);

		await retry(() => {
			expect(onDeleteLine1).toHaveBeenCalledTimes(1);
			expect(onDeleteLine2).toHaveBeenCalledTimes(1);
			expect(onDeleteLine3).toHaveBeenCalledTimes(1);
		});

		expect(onDeleteLine1).toHaveBeenCalledWith(mapData.adminId, { id: createdLine.id });
		expect(onDeleteLine2).toHaveBeenCalledWith(mapData.readId, { id: createdLine.id });
		expect(onDeleteLine3).toHaveBeenCalledWith(mapData.readId, { id: createdLine.id });

		const expectedLineRecord = { };
		expect(cloneDeep(storage1.maps[mapData.adminId].lines)).toEqual(expectedLineRecord);
		expect(cloneDeep(storage2.maps[mapData.readId].lines)).toEqual(expectedLineRecord);
		expect(cloneDeep(storage3.maps[mapData.readId].lines)).toEqual(expectedLineRecord);
	});
});

test("Find line", async () => {
	const storage1 = await openClientStorage();

	await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
		const storage2 = await openClientStorage(mapData.readId);

		const lineType = Object.values(storage1.maps[mapData.adminId].types).find((t) => t.type === "line")!;

		const marker = await storage1.client.createLine(mapData.adminId, {
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

		expect(await storage2.client.findOnMap(mapData.readId, "Test")).toEqual([{ ...expectedResult, similarity: 0.4 }]);
		expect(await storage2.client.findOnMap(mapData.readId, "T_st")).toEqual([{ ...expectedResult, similarity: 0.2 }]);
		expect(await storage2.client.findOnMap(mapData.readId, "L%e")).toEqual([{ ...expectedResult, similarity: 0 }]);
		expect(await storage2.client.findOnMap(mapData.readId, "Bla")).toEqual([]);
	});
});

test("Try to create line with marker type", async () => {
	const storage = await openClientStorage();

	await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
		const lineType = Object.values(storage.maps[mapData.adminId].types).find((t) => t.type === "marker")!;

		await expect(async () => {
			await storage.client.createLine(mapData.adminId, {
				routePoints: [
					{ lat: 6, lon: 6 },
					{ lat: 14, lon: 14 }
				],
				typeId: lineType.id
			});
		}).rejects.toThrowError("Cannot use marker type for line");

		const storage3 = await openClientStorage(createMapData.adminId);
		await storage3.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
		expect(cloneDeep(storage3.maps[createMapData.adminId].lines)).toEqual({});
	});
});

test("Try to update line with line type", async () => {
	const storage = await openClientStorage();

	await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
		const markerType = Object.values(storage.maps[mapData.adminId].types).find((t) => t.type === "marker")!;
		const lineType = Object.values(storage.maps[mapData.adminId].types).find((t) => t.type === "line")!;

		const line = await storage.client.createLine(mapData.adminId, {
			routePoints: [
				{ lat: 6, lon: 6 },
				{ lat: 14, lon: 14 }
			],
			typeId: lineType.id
		});

		await expect(async () => {
			await storage.client.updateLine(mapData.adminId, line.id, {
				typeId: markerType.id
			});
		}).rejects.toThrowError("Cannot use marker type for line");

		const storage3 = await openClientStorage(createMapData.adminId);
		expect(cloneDeep(storage3.maps[createMapData.adminId].lines)).toEqual({
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
	const storage1 = await openClientStorage();
	const storage2 = await openClientStorage();

	await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
		await createTemporaryMap(storage2, {}, async (createMapData2, mapData2) => {
			const lineType2 = Object.values(storage2.maps[mapData2.adminId].types).find((t) => t.type === "line")!;

			await expect(async () => {
				await storage1.client.createLine(mapData.adminId, {
					routePoints: [
						{ lat: 6, lon: 6 },
						{ lat: 14, lon: 14 }
					],
					typeId: lineType2.id
				});
			}).rejects.toThrowError("could not be found");

			const storage3 = await openClientStorage(createMapData.adminId);
			await storage3.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
			expect(cloneDeep(storage3.maps[createMapData.adminId].lines)).toEqual({});
		});
	});
});

test("Try to update line with line type from other map", async () => {
	const storage1 = await openClientStorage();
	const storage2 = await openClientStorage();

	await createTemporaryMap(storage1, {}, async (createMapData, mapData) => {
		await createTemporaryMap(storage2, {}, async (createMapData2, mapData2) => {
			const lineType1 = Object.values(storage1.maps[mapData.adminId].types).find((t) => t.type === "line")!;
			const lineType2 = Object.values(storage2.maps[mapData2.adminId].types).find((t) => t.type === "line")!;

			const line = await storage1.client.createLine(mapData.adminId, {
				routePoints: [
					{ lat: 6, lon: 6 },
					{ lat: 14, lon: 14 }
				],
				typeId: lineType1.id
			});

			await expect(async () => {
				await storage1.client.updateLine(mapData.adminId, line.id, {
					typeId: lineType2.id
				});
			}).rejects.toThrowError("could not be found");

			const storage3 = await openClientStorage(createMapData.adminId);
			await storage3.client.setBbox({ top: 20, bottom: 0, left: 0, right: 20, zoom: 1 });
			expect(cloneDeep(storage3.maps[createMapData.adminId].lines)).toEqual({
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
	const storage = await openClientStorage();

	await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
		const lineType = Object.values(storage.maps[mapData.adminId].types).find((t) => t.type === "line")!;

		const line = await storage.client.createLine(mapData.adminId, {
			routePoints: [
				{ lat: 6, lon: 6 },
				{ lat: 14, lon: 14 }
			],
			typeId: lineType.id
		});

		const exportedTrk = await new Response((await storage.client.exportLine(mapData.adminId, line.id, { format: "gpx-trk" })).data).text();
		expect(exportedTrk.replace(/<time>[^<]*<\/time>/, "<time></time>")).toEqual(
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

		const exportedRte = await new Response((await storage.client.exportLine(mapData.adminId, line.id, { format: "gpx-rte" })).data).text();
		expect(exportedRte.replace(/<time>[^<]*<\/time>/, "<time></time>")).toEqual(
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
	const storage = await openClientStorage();

	await createTemporaryMap(storage, {}, async (createMapData, mapData) => {
		const lineType = Object.values(storage.maps[mapData.adminId].types).find((t) => t.type === "line")!;

		const line = await storage.client.createLine(mapData.adminId, {
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

		const exportedTrk = await new Response((await storage.client.exportLine(mapData.adminId, line.id, { format: "gpx-trk" })).data).text();
		expect(exportedTrk.replace(/<time>[^<]*<\/time>/, "<time></time>")).toEqual(
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

		const exportedRte = await new Response((await storage.client.exportLine(mapData.adminId, line.id, { format: "gpx-rte" })).data).text();
		expect(exportedRte.replace(/<time>[^<]*<\/time>/, "<time></time>")).toEqual(
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