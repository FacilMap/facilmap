import { expect, test } from "vitest";
import { DefaultReactiveObjectProvider, _defineDynamicGetters } from "../reactivity";

test("_defineDynamicGetters", () => {
	const reactiveObjectProvider = new DefaultReactiveObjectProvider();

	const data = reactiveObjectProvider.create<any>({
		test1: "test 1"
	});

	const obj: any = {};
	_defineDynamicGetters(obj, data, reactiveObjectProvider);

	expect(obj.test1).toEqual("test 1");

	reactiveObjectProvider.set(data, "test2", "test 2");
	expect(obj.test2).toEqual("test 2");
});