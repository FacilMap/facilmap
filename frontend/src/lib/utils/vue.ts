import { type ComponentPublicInstance, type DeepReadonly, type Directive, type Ref, computed, onScopeDispose, reactive, readonly, ref, shallowReadonly, shallowRef, toRef, watch } from "vue";

export const vScrollIntoView: Directive<Element, boolean | undefined> = (el, binding) => {
	if (binding.value)
		el.scrollIntoView({ behavior: "smooth", block: "nearest" });
};

/**
 * Returns a computed property that is recomputed every time the window is resized.
 */
export function computedOnResize<T>(getValue: () => T): Readonly<Ref<T>> {
	const value = shallowRef(getValue());

	const handleResize = () => {
		value.value = getValue();
	};

	window.addEventListener("resize", handleResize);

	onScopeDispose(() => {
		window.removeEventListener("resize", handleResize);
	});

	return shallowReadonly(value);
}

export function useRefWithOverride<Value>(fallbackValue: Value, getProp: () => Value | undefined, onUpdate: (newValue: Value) => void): Ref<Value> {
    const internalValue = ref(getProp() ?? fallbackValue);
    return computed({
        get: (): Value => {
            const propValue = getProp();
            return propValue !== undefined ? propValue : internalValue.value as Value;
        },
        set: (val: Value) => {
            internalValue.value = val as any;
            onUpdate(val);
        }
    });
}

export function mapRef<K>(map: Map<K, Element | ComponentPublicInstance>, key: K): (ref: Element | ComponentPublicInstance | null) => void {
	return (ref) => {
		if (ref) {
			map.set(key, ref);
		} else {
			map.delete(key);
		}
	};
}

export function useResizeObserver(
	element: Ref<HTMLElement | undefined>,
	callback?: (entry: ResizeObserverEntry) => void
): DeepReadonly<Ref<ResizeObserverEntry | undefined>> {
	const entry = ref<ResizeObserverEntry>();
	const observer = new ResizeObserver((entries) => {
		entry.value = entries[0];
		callback?.(entry.value);
	});

	watch(element, (value, oldValue, onCleanup) => {
		if (value) {
			observer.observe(value);
			onCleanup(() => {
				observer.unobserve(value);
			});
		}
	}, { immediate: true });

	return readonly(entry);
}

export function reactiveReadonlyView<T extends Record<any, any>>(source: Ref<Record<any, any>> | (() => T)): Readonly<T> {
	const sourceRef = toRef(source);
	const result = reactive<any>({});
	watch(() => Object.entries(sourceRef.value), () => {
		const keys = Object.keys(sourceRef.value);
		for (const key of Object.keys(result)) {
			if (!keys.includes(key)) {
				delete result[key];
			}
		}
		for (const [key, value] of Object.entries(sourceRef.value)) {
			result[key] = value;
		}
	}, { immediate: true, flush: 'sync' });
	return shallowReadonly(result);
}