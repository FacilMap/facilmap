import { expect, test, vi } from "vitest";
import { ref, watch } from "vue";
import { reactiveReadonlyView } from "../vue";

test("reactiveReadonlyView", () => {
	const source = ref<{
		test?: string;
	}>({
		test: "test"
	});

	const target = reactiveReadonlyView(source);

	const testWatcher = vi.fn();
	watch(() => target.test, testWatcher, { flush: "sync" });

	expect(target).toEqual({ test: "test" });
	expect(testWatcher).toBeCalledTimes(0);

	source.value.test = "test2";
	expect(testWatcher).toBeCalledTimes(1);
	expect(target).toEqual({ test: "test2" });

	delete source.value.test;
	expect(testWatcher).toBeCalledTimes(2);
	expect(target).toEqual({});
});