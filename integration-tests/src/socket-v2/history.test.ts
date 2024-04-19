import { expect, test, vi } from "vitest";
import { createTemporaryPad, openClient, retry } from "../utils";
import { CRU, SocketVersion, type ID, type LegacyV2Type } from "facilmap-types";

test("Marker update history (socket v2)", async () => {
	const client1 = await openClient(undefined, SocketVersion.V2);

	await createTemporaryPad(client1, {}, async (createPadData, padData) => {
		const client2 = await openClient(padData.adminId);

		const markerType = Object.values(client1.types).find((t) => t.type === "marker")!;

		const createdMarker = await client1.addMarker({
			lat: 10,
			lon: 10,
			typeId: markerType.id,
			ele: null,
			symbol: "icon1"
		});

		await Promise.all([
			client1.listenToHistory(),
			client2.listenToHistory()
		]);

		const onHistory1 = vi.fn();
		client1.on("history", onHistory1);
		const onHistory2 = vi.fn();
		client2.on("history", onHistory2);

		const newData = {
			id: createdMarker.id,
			symbol: "icon2"
		};
		await client1.editMarker(newData);

		await retry(() => {
			expect(onHistory1).toHaveBeenCalledTimes(1);
			expect(onHistory2).toHaveBeenCalledTimes(1);
		});

		expect(onHistory1).toHaveBeenCalledWith(expect.objectContaining({
			objectBefore: expect.objectContaining({
				symbol: "icon1"
			}),
			objectAfter: expect.objectContaining({
				symbol: "icon2"
			})
		}));

		expect(onHistory2).toHaveBeenCalledWith(expect.objectContaining({
			objectBefore: expect.objectContaining({
				icon: "icon1"
			}),
			objectAfter: expect.objectContaining({
				icon: "icon2"
			})
		}));
	});
});

test("Type update history (socket v2)", async () => {
	const client1 = await openClient(undefined, SocketVersion.V2);

	await createTemporaryPad(client1, { createDefaultTypes: false }, async (createPadData, padData, result) => {
		const client2 = await openClient(padData.adminId);

		const createdType = await client1.addType({
			name: "Test type",
			type: "marker",
			defaultSymbol: "icon1",
			symbolFixed: false,
			fields: [{
				type: "dropdown",
				name: "Test",
				controlSymbol: false,
				options: [{
					value: "Test",
					symbol: "test1"
				}]
			}]
		});

		await Promise.all([
			client1.listenToHistory(),
			client2.listenToHistory()
		]);

		const onHistory1 = vi.fn();
		client1.on("history", onHistory1);
		const onHistory2 = vi.fn();
		client2.on("history", onHistory2);

		const update = {
			id: createdType.id,
			defaultSymbol: "icon2",
			symbolFixed: true,
			fields: [{
				type: "dropdown",
				name: "Test",
				controlSymbol: true,
				options: [{
					value: "Test",
					symbol: "test2"
				}]
			}]
		} satisfies LegacyV2Type<CRU.UPDATE> & { id: ID };

		await client1.editType(update);

		await retry(() => {
			expect(onHistory1).toHaveBeenCalledTimes(1);
			expect(onHistory2).toHaveBeenCalledTimes(1);
		});

		expect(onHistory1).toHaveBeenCalledWith(expect.objectContaining({
			objectBefore: expect.objectContaining({
				defaultSymbol: "icon1",
				symbolFixed: false,
				fields: [expect.objectContaining({
					controlSymbol: false,
					options: [expect.objectContaining({
						symbol: "test1"
					})]
				})]
			}),
			objectAfter: expect.objectContaining({
				defaultSymbol: "icon2",
				symbolFixed: true,
				fields: [expect.objectContaining({
					controlSymbol: true,
					options: [expect.objectContaining({
						symbol: "test2"
					})]
				})]
			})
		}));

		expect(onHistory2).toHaveBeenCalledWith(expect.objectContaining({
			objectBefore: expect.objectContaining({
				defaultIcon: "icon1",
				iconFixed: false,
				fields: [expect.objectContaining({
					controlIcon: false,
					options: [expect.objectContaining({
						icon: "test1"
					})]
				})]
			}),
			objectAfter: expect.objectContaining({
				defaultIcon: "icon2",
				iconFixed: true,
				fields: [expect.objectContaining({
					controlIcon: true,
					options: [expect.objectContaining({
						icon: "test2"
					})]
				})]
			})
		}));
	});
});