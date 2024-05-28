import { expect, test, vi } from "vitest";
import { computed, ref } from "vue";
import { computedWithCleanup, withoutTracking } from "../vue";

test("computedWithCleanup", () => {
	const val = ref(1);
	const onCleanupCallback = vi.fn();
	const val2 = computedWithCleanup((oldValue, onCleanup) => {
		onCleanup(onCleanupCallback);
		return val.value + 1;
	});

	expect(val2.value).toBe(2);
	expect(onCleanupCallback).toBeCalledTimes(0);

	val.value++;
	expect(val2.value).toBe(3);
	expect(onCleanupCallback).toBeCalledTimes(1);

	val.value++;
	expect(val2.value).toBe(4);
	expect(onCleanupCallback).toBeCalledTimes(2);
});

test("withoutTracking", () => {
	const val1 = ref(1);
	const val2 = ref(1);
	const effect = vi.fn(() => {
		return `${val1.value}${withoutTracking(() => val2.value)}`;
	});
	const result = computed(effect);

	expect(effect).toBeCalledTimes(0);
	expect(result.value).toEqual("11");
	expect(effect).toBeCalledTimes(1);

	val1.value++;
	expect(effect).toBeCalledTimes(1);
	expect(result.value).toEqual("21");
	expect(effect).toBeCalledTimes(2);

	val2.value++;
	expect(effect).toBeCalledTimes(2);
	expect(result.value).toEqual("21");
	expect(effect).toBeCalledTimes(2);

	val1.value++;
	expect(effect).toBeCalledTimes(2);
	expect(result.value).toEqual("32");
	expect(effect).toBeCalledTimes(3);
});