import { expect, test, vi } from "vitest";
import { createTemporaryPad, openClient } from "./utils";
import { type CRU, type View } from "facilmap-types";

test("Database views", async () => {
	const client = await openClient();

	const onView = vi.fn();
	client.on("view", onView);

	const onPadData = vi.fn();
	client.on("padData", onPadData);

	await createTemporaryPad(client, {}, async (padData) => {
		// Create View 1

		const view1 = {
			name: "Test view 1",
			left: -10,
			right: 10,
			top: -20,
			bottom: 20,
			baseLayer: "Mpnk",
			layers: []
		} satisfies View<CRU.CREATE>;

		const view1Result = await client.addView(view1);

		const expectedView1: View = {
			...view1,
			filter: null,
			id: view1Result.id,
			padId: padData.id
		};

		expect(view1Result).toEqual(expectedView1);
		expect(onView).toBeCalledTimes(1);
		expect(onView).toHaveBeenNthCalledWith(1, expectedView1);
		expect(client.views).toEqual({
			[expectedView1.id]: expectedView1
		});


		// Create view 2

		const view2 = {
			name: "Test view 2",
			left: -30,
			right: 30,
			top: -40,
			bottom: 40,
			baseLayer: "ToPl",
			layers: ["grid"],
			filter: "name == \"\""
		} satisfies View<CRU.CREATE>;

		const view2Result = await client.addView(view2);

		const expectedView2: View = {
			...view2,
			id: view2Result.id,
			padId: padData.id
		};

		expect(view2Result).toEqual(expectedView2);
		expect(onView).toBeCalledTimes(2);
		expect(onView).toHaveBeenNthCalledWith(2, expectedView2);
		expect(client.views).toEqual({
			[expectedView1.id]: expectedView1,
			[expectedView2.id]: expectedView2
		});


		// Set view 2 as default view
		const padResult = await client.editPad({
			defaultViewId: expectedView2.id
		});
		expect(padResult.defaultView).toEqual(expectedView2);
		expect(onPadData.mock.lastCall[0].defaultView).toEqual(expectedView2);
	});
});
