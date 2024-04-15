import { expect, test } from "vitest";
import { createTemporaryPad, openClient } from "../../utils";

test("Reorder types", async () => {
	const client = await openClient();

	await createTemporaryPad(client, { createDefaultTypes: false }, async (padData) => {
		const type1 = await client.addType({
			name: "Test type 1",
			type: "marker"
		});

		expect(type1.idx).toEqual(0);

		const type2 = await client.addType({
			name: "Test type 2",
			type: "line",
			idx: 3
		});

		expect(type2.idx).toEqual(3);

		const type3 = await client.addType({
			name: "Test type 3",
			type: "marker",
			idx: 0 // Should move type1 down, but not type2 (since there is a gap)
		});
		expect(type3.idx).toEqual(0);
		expect(client.types[type1.id].idx).toEqual(1);
		expect(client.types[type2.id].idx).toEqual(3);

		const updatedType1 = await client.editType({
			id: type1.id,
			idx: 0 // Should move type3 down, but not type2 (since there is a gap)
		});
		expect(updatedType1.idx).toEqual(0);
		expect(client.types[type2.id].idx).toEqual(3);
		expect(client.types[type3.id].idx).toEqual(1);

		const newUpdatedType1 = await client.editType({
			id: type1.id,
			idx: 3 // Should move type2 down but leave type3 untouched
		});
		expect(newUpdatedType1.idx).toEqual(3);
		expect(client.types[type2.id].idx).toEqual(4);
		expect(client.types[type3.id].idx).toEqual(1);
	});
});