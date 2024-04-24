import { expect, test, vi } from "vitest";
import { createTemporaryMapV2, openClient, retry } from "../utils";
import { CRU, SocketVersion, type ID, type LegacyV2Type } from "facilmap-types";
import { cloneDeep } from "lodash-es";

test("Create type (socket v2)", async () => {
	const client1 = await openClient(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client1, { createDefaultTypes: false }, async (createMapData, mapData, result) => {
		const client2 = await openClient(mapData.id, SocketVersion.V2);

		const onType1 = vi.fn();
		client1.on("type", onType1);

		const onType2 = vi.fn();
		client2.on("type", onType2);

		const type = {
			name: "Test type",
			type: "marker",
			defaultSymbol: "icon",
			symbolFixed: true,
			fields: [{
				type: "dropdown",
				name: "Test",
				controlSymbol: true,
				options: [{
					value: "Test",
					symbol: "test"
				}]
			}]
		} satisfies LegacyV2Type<CRU.CREATE>;

		const typeResult = await client1.addType(type);

		expect(typeResult).toMatchObject(type);

		await retry(async () => {
			expect(onType1).toBeCalledTimes(1);
			expect(onType2).toBeCalledTimes(1);
		});

		expect(onType1).toHaveBeenNthCalledWith(1, expect.objectContaining(type));
		expect(cloneDeep(client1.types)).toEqual({
			[typeResult.id]: expect.objectContaining({ ...type, padId: mapData.id })
		});

		expect(onType2).toHaveBeenNthCalledWith(1, expect.objectContaining(type));
		expect(cloneDeep(client2.types)).toEqual({
			[typeResult.id]: expect.objectContaining({ ...type, padId: mapData.id })
		});

		const client3 = await openClient(mapData.id, SocketVersion.V2);
		expect(cloneDeep(client3.types)).toEqual({
			[typeResult.id]: expect.objectContaining({ ...type, padId: mapData.id })
		});

		const client4 = await openClient(mapData.id);
		expect(cloneDeep(client4.types)).toEqual({
			[typeResult.id]: expect.objectContaining({
				defaultIcon: "icon",
				iconFixed: true,
				fields: [expect.objectContaining({
					controlIcon: true,
					options: [expect.objectContaining({
						value: "Test",
						icon: "test"
					})]
				})]
			})
		});
	});
});

test("Update type (socket v2)", async () => {
	const client1 = await openClient(undefined, SocketVersion.V2);

	const onType = vi.fn();
	client1.on("type", onType);

	await createTemporaryMapV2(client1, { createDefaultTypes: false }, async (createMapData, mapData, result) => {
		const createdType = await client1.addType({
			name: "Test type",
			type: "marker"
		});

		const client2 = await openClient(mapData.id, SocketVersion.V2);

		const onType1 = vi.fn();
		client1.on("type", onType1);

		const onType2 = vi.fn();
		client2.on("type", onType2);

		const update = {
			id: createdType.id,
			defaultSymbol: "icon",
			symbolFixed: true,
			fields: [{
				type: "dropdown",
				name: "Test",
				controlSymbol: true,
				options: [{
					value: "Test",
					symbol: "test"
				}]
			}]
		} satisfies LegacyV2Type<CRU.UPDATE> & { id: ID };

		const typeResult = await client1.editType(update);

		expect(typeResult).toMatchObject({ ...update, padId: mapData.id });

		await retry(async () => {
			expect(onType1).toBeCalledTimes(1);
			expect(onType2).toBeCalledTimes(1);
		});

		expect(onType1).toHaveBeenNthCalledWith(1, expect.objectContaining({ ...update, padId: mapData.id }));
		expect(cloneDeep(client1.types)).toEqual({
			[createdType.id]: expect.objectContaining({ ...update, padId: mapData.id })
		});

		expect(onType2).toHaveBeenNthCalledWith(1, expect.objectContaining({ ...update, padId: mapData.id }));
		expect(cloneDeep(client2.types)).toEqual({
			[createdType.id]: expect.objectContaining({ ...update, padId: mapData.id })
		});

		const client3 = await openClient(mapData.id);
		expect(cloneDeep(client3.types)).toEqual({
			[createdType.id]: expect.objectContaining({
				defaultIcon: "icon",
				iconFixed: true,
				fields: [expect.objectContaining({
					controlIcon: true,
					options: [expect.objectContaining({
						icon: "test"
					})]
				})]
			})
		});
	});
});

test("Delete type (socket v2)", async () => {
	const client = await openClient(undefined, SocketVersion.V2);

	await createTemporaryMapV2(client, { createDefaultTypes: false }, async (createMapData, mapData, result) => {
		const type = await client.addType({
			name: "Test type",
			type: "marker",
			defaultSymbol: "icon",
			symbolFixed: true,
			fields: [{
				type: "dropdown",
				name: "Test",
				controlSymbol: true,
				options: [{
					value: "Test",
					symbol: "test"
				}]
			}]
		});

		const deletedType = await client.deleteType({ id: type.id });

		expect(deletedType).toEqual(type);
	});
});