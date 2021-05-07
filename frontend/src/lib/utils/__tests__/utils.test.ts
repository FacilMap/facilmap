import { mergeObject } from "../utils";

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