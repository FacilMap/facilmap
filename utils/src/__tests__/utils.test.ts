import { expect, test } from "vitest";
import { insertIdx, mergeObject } from "../utils";

test('mergeObject', () => {
	interface TestObject {
		str?: string;
		obj?: {
			str?: string;
		}
	}

	function merge(oldObject: TestObject, newObject: TestObject, targetObject: TestObject): TestObject {
		mergeObject(oldObject, newObject, targetObject);
		return targetObject;
	}

	expect(merge({ str: "old" }, { str: "old" }, { str: "custom" }))
		.toEqual({ str: "custom" });

	expect(merge({ }, { }, { str: "custom" }))
		.toEqual({ str: "custom" });


	expect(merge({ str: "old" }, { str: "old" }, { }))
		.toEqual({ });

	expect(merge({ }, { }, { }))
		.toEqual({ });


	expect(merge({ str: "old" }, { str: "new" }, { str: "custom" }))
		.toEqual({ str: "new" });

	expect(merge({ }, { str: "new" }, { str: "custom" }))
		.toEqual({ str: "new" });

	expect(merge({ str: "old" }, { }, { str: "custom" }))
		.toEqual({ });


	expect(merge({ str: "old" }, { str: "new" }, { }))
		.toEqual({ str: "new" });

	expect(merge({ }, { str: "new" }, { }))
		.toEqual({ str: "new" });



	expect(merge({ obj: { str: "old" } }, { obj: { str: "old" } }, { obj: { str: "custom" } }))
		.toEqual({ obj: { str: "custom" } });

	expect(merge({ obj: { } }, { obj: { } }, { obj: { str: "custom" } }))
		.toEqual({ obj: { str: "custom" } });

		expect(merge({ }, { }, { obj: { str: "custom" } }))
		.toEqual({ obj: { str: "custom" } });


	expect(merge({ obj: { str: "old" } }, { obj: { str: "old" } }, { obj: { } }))
		.toEqual({ obj: { } });

	expect(merge({ obj: { } }, { obj: { } }, { obj: { } }))
		.toEqual({ obj: { } });

	expect(merge({ }, { }, { obj: { } }))
		.toEqual({ obj: { } });


	expect(merge({ obj: { str: "old" } }, { obj: { str: "old" } }, { }))
		.toEqual({ });

	expect(merge({ obj: { } }, { obj: { } }, { }))
		.toEqual({ });


	expect(merge({ obj: { str: "old" } }, { obj: { str: "new" } }, { obj: { str: "custom" } }))
		.toEqual({ obj: { str: "new" } });

	expect(merge({ obj: { } }, { obj: { str: "new" } }, { obj: { str: "custom" } }))
		.toEqual({ obj: { str: "new" } });

	expect(merge({ }, { obj: { str: "new" } }, { obj: { str: "custom" } }))
		.toEqual({ obj: { str: "new" } });

	expect(merge({ obj: { str: "old" } }, { obj: { } }, { obj: { str: "custom" } }))
		.toEqual({ obj: { } });

	expect(merge({ obj: { str: "old" } }, { }, { obj: { str: "custom" } }))
		.toEqual({ });


	expect(merge({ obj: { str: "old" } }, { obj: { str: "new" } }, { obj: { } }))
		.toEqual({ obj: { str: "new" } });

	expect(merge({ obj: { } }, { obj: { str: "new" } }, { obj: { } }))
		.toEqual({ obj: { str: "new" } });


	expect(merge({ obj: { str: "old" } }, { obj: { str: "new" } }, { }))
		.toEqual({ obj: { str: "new" } });

	expect(merge({ obj: { } }, { obj: { str: "new" } }, { }))
		.toEqual({ obj: { str: "new" } });

});

test('mergeObject prototype pollution', () => {
	mergeObject({}, JSON.parse('{"__proto__":{"test": "test"}}'), {});
	expect(({} as any).test).toBeUndefined();
});

test("insertAtIdx", () => {
	const list = [
		{ id: 0, idx: 0 },
		{ id: 1, idx: 1 },
		{ id: 2, idx: 3 }
	];

	// Create new item

	expect(insertIdx(list, undefined, 0)).toEqual([
		{ id: 0, oldIdx: 0, newIdx: 1 },
		{ id: 1, oldIdx: 1, newIdx: 2 },
		{ id: 2, oldIdx: 3, newIdx: 3 }
	]);

	expect(insertIdx(list, undefined, 1)).toEqual([
		{ id: 0, oldIdx: 0, newIdx: 0 },
		{ id: 1, oldIdx: 1, newIdx: 2 },
		{ id: 2, oldIdx: 3, newIdx: 3 }
	]);

	expect(insertIdx(list, undefined, 2)).toEqual([
		{ id: 0, oldIdx: 0, newIdx: 0 },
		{ id: 1, oldIdx: 1, newIdx: 1 },
		{ id: 2, oldIdx: 3, newIdx: 3 }
	]);

	expect(insertIdx(list, undefined, 3)).toEqual([
		{ id: 0, oldIdx: 0, newIdx: 0 },
		{ id: 1, oldIdx: 1, newIdx: 1 },
		{ id: 2, oldIdx: 3, newIdx: 4 }
	]);

	expect(insertIdx(list, undefined, 4)).toEqual([
		{ id: 0, oldIdx: 0, newIdx: 0 },
		{ id: 1, oldIdx: 1, newIdx: 1 },
		{ id: 2, oldIdx: 3, newIdx: 3 }
	]);


	// Move existing item down
	expect(insertIdx(list, 0, 0)).toEqual([
		{ id: 0, oldIdx: 0, newIdx: 0 },
		{ id: 1, oldIdx: 1, newIdx: 1 },
		{ id: 2, oldIdx: 3, newIdx: 3 }
	]);

	expect(insertIdx(list, 0, 1)).toEqual([
		{ id: 0, oldIdx: 0, newIdx: 1 },
		{ id: 1, oldIdx: 1, newIdx: 2 },
		{ id: 2, oldIdx: 3, newIdx: 3 }
	]);

	expect(insertIdx(list, 0, 2)).toEqual([
		{ id: 0, oldIdx: 0, newIdx: 2 },
		{ id: 1, oldIdx: 1, newIdx: 1 },
		{ id: 2, oldIdx: 3, newIdx: 3 }
	]);

	expect(insertIdx(list, 0, 3)).toEqual([
		{ id: 0, oldIdx: 0, newIdx: 3 },
		{ id: 1, oldIdx: 1, newIdx: 1 },
		{ id: 2, oldIdx: 3, newIdx: 4 }
	]);

	expect(insertIdx(list, 0, 4)).toEqual([
		{ id: 0, oldIdx: 0, newIdx: 4 },
		{ id: 1, oldIdx: 1, newIdx: 1 },
		{ id: 2, oldIdx: 3, newIdx: 3 }
	]);


	// Move existing item down
	expect(insertIdx(list, 2, 0)).toEqual([
		{ id: 0, oldIdx: 0, newIdx: 1 },
		{ id: 1, oldIdx: 1, newIdx: 2 },
		{ id: 2, oldIdx: 3, newIdx: 0 }
	]);

	expect(insertIdx(list, 2, 1)).toEqual([
		{ id: 0, oldIdx: 0, newIdx: 0 },
		{ id: 1, oldIdx: 1, newIdx: 2 },
		{ id: 2, oldIdx: 3, newIdx: 1 }
	]);

	expect(insertIdx(list, 2, 2)).toEqual([
		{ id: 0, oldIdx: 0, newIdx: 0 },
		{ id: 1, oldIdx: 1, newIdx: 1 },
		{ id: 2, oldIdx: 3, newIdx: 2 }
	]);

	expect(insertIdx(list, 2, 3)).toEqual([
		{ id: 0, oldIdx: 0, newIdx: 0 },
		{ id: 1, oldIdx: 1, newIdx: 1 },
		{ id: 2, oldIdx: 3, newIdx: 3 }
	]);
});