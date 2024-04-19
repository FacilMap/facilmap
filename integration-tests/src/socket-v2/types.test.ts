import { expect, test, vi } from "vitest";
import { createTemporaryPad, openClient, retry } from "../utils";
import { CRU, SocketVersion, type ID, type LegacyV2Type } from "facilmap-types";
import { cloneDeep } from "lodash-es";

test("Create type (socket v2)", async () => {
	const client1 = await openClient(undefined, SocketVersion.V2);

	await createTemporaryPad(client1, { createDefaultTypes: false }, async (createPadData, padData, result) => {
		const client2 = await openClient(padData.id, SocketVersion.V2);

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
			[typeResult.id]: expect.objectContaining(type)
		});

		expect(onType2).toHaveBeenNthCalledWith(1, expect.objectContaining(type));
		expect(cloneDeep(client2.types)).toEqual({
			[typeResult.id]: expect.objectContaining(type)
		});

		const client3 = await openClient(padData.id, SocketVersion.V2);
		expect(cloneDeep(client3.types)).toEqual({
			[typeResult.id]: expect.objectContaining(type)
		});

		const client4 = await openClient(padData.id);
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

	await createTemporaryPad(client1, { createDefaultTypes: false }, async (createPadData, padData, result) => {
		const createdType = await client1.addType({
			name: "Test type",
			type: "marker"
		});

		const client2 = await openClient(padData.id, SocketVersion.V2);

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

		expect(typeResult).toMatchObject(update);

		await retry(async () => {
			expect(onType1).toBeCalledTimes(1);
			expect(onType2).toBeCalledTimes(1);
		});

		expect(onType1).toHaveBeenNthCalledWith(1, expect.objectContaining(update));
		expect(cloneDeep(client1.types)).toEqual({
			[createdType.id]: expect.objectContaining(update)
		});

		expect(onType2).toHaveBeenNthCalledWith(1, expect.objectContaining(update));
		expect(cloneDeep(client2.types)).toEqual({
			[createdType.id]: expect.objectContaining(update)
		});

		const client3 = await openClient(padData.id);
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

	await createTemporaryPad(client, { createDefaultTypes: false }, async (createPadData, padData, result) => {
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