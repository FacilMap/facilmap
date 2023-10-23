import { ComponentPublicInstance, DeepReadonly, Ref, computed, onScopeDispose, readonly, ref, shallowReadonly, shallowRef, watch } from "vue";
import { Field, RouteMode } from "facilmap-types";
import { formatField, formatRouteMode, formatTime, round } from "facilmap-utils";

// Vue.directive("fm-scroll-into-view", {
// 	inserted(el, binding) {
// 		if (binding.value)
// 			el.scrollIntoView({ behavior: "smooth", block: "nearest" });
// 	},

// 	update(el, binding) {
// 		if (binding.value && !binding.oldValue)
// 			el.scrollIntoView({ behavior: "smooth", block: "nearest" })
// 	}
// });

// Vue.filter('round', (number: number, digits: number) => round(number, digits));

// Vue.filter('fmFieldContent', (value: string, field: Field) => formatField(field, value));

// Vue.filter('fmFormatTime', (value: number) => formatTime(value));

// Vue.filter('fmRouteMode', (value: RouteMode) => formatRouteMode(value));

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

export function useResizeObserver(element: Ref<HTMLElement | undefined>): DeepReadonly<Ref<ResizeObserverEntry | undefined>> {
	const entry = ref<ResizeObserverEntry>();
	const observer = new ResizeObserver((entries) => {
		entry.value = entries[0];
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
