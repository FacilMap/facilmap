import { describe, expect, test } from "vitest";
import { createTemporaryMap, getRestClient, openClientStorage } from "../../utils";
import { ApiVersion, SocketVersion } from "facilmap-types";

describe.for([
	{ label: "Socket API", useSocket: true },
	{ label: "REST API", useSocket: false }
])("Type order tests ($label)", ({ useSocket }) => {

	const restClient = useSocket ? undefined : getRestClient(ApiVersion.V3);

	test("Reorder types", async () => {
		const storage = await openClientStorage(undefined, SocketVersion.V3);

		await createTemporaryMap(storage, { createDefaultTypes: false }, async (mapData) => {
			const type1 = await (restClient ?? storage.client).createType(mapData.adminId, {
				name: "Test type 1",
				type: "marker"
			});

			expect(type1.idx).toEqual(0);

			const type2 = await (restClient ?? storage.client).createType(mapData.adminId, {
				name: "Test type 2",
				type: "line",
				idx: 3
			});

			expect(type2.idx).toEqual(3);

			const type3 = await (restClient ?? storage.client).createType(mapData.adminId, {
				name: "Test type 3",
				type: "marker",
				idx: 0 // Should move type1 down, but not type2 (since there is a gap)
			});
			expect(type3.idx).toEqual(0);
			expect(storage.maps[mapData.adminId].types[type1.id].idx).toEqual(1);
			expect(storage.maps[mapData.adminId].types[type2.id].idx).toEqual(3);

			const updatedType1 = await (restClient ?? storage.client).updateType(mapData.adminId, type1.id, {
				idx: 0 // Should move type3 down, but not type2 (since there is a gap)
			});
			expect(updatedType1.idx).toEqual(0);
			expect(storage.maps[mapData.adminId].types[type2.id].idx).toEqual(3);
			expect(storage.maps[mapData.adminId].types[type3.id].idx).toEqual(1);

			const newUpdatedType1 = await (restClient ?? storage.client).updateType(mapData.adminId, type1.id, {
				idx: 3 // Should move type2 down but leave type3 untouched
			});
			expect(newUpdatedType1.idx).toEqual(3);
			expect(storage.maps[mapData.adminId].types[type2.id].idx).toEqual(4);
			expect(storage.maps[mapData.adminId].types[type3.id].idx).toEqual(1);
		});
	});

});