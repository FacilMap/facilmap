import { cloneDeep, isEqual } from "lodash-es";
import { type ComponentPublicInstance, type DeepReadonly, type Directive, type Ref, computed, onScopeDispose, readonly, ref, shallowReadonly, shallowRef, watch, type ComputedGetter, type Component, type VNodeProps, type AllowedComponentProps, onBeforeUnmount, onMounted, toRaw } from "vue";

// https://stackoverflow.com/a/73784241/242365
export type ComponentProps<C extends Component> = C extends new (...args: any) => any
  ? Omit<InstanceType<C>['$props'], keyof VNodeProps | keyof AllowedComponentProps>
  : never;

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

/**
 * Returns a ref that represents the value of a prop but falls back to an internal state if the prop is not specified. This can be used to make a model prop
 * optional, so that if a v-model directive is used on the component, its state is persisted in the external model, but if v-model is not used, its state
 * is persisted in an internal value.
 * @param fallbackValue The initial value if the prop is undefined
 * @param getProp A getter for the model value prop. If it returns undefined, the prop is considered not set and the internal value is used instead.
 * @param onUpdate This is called when the value is set. This should emit the update:modelValue (or similar) event.
 */
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

/**
 * Returns a ref that represents the internal value of a form field whose value is only applied to a model if it passes a certain validation. An example for this would be
 * a text field that is bound to a number field. The user should be able to type in the field freely, even if the value is temporarily not a valid number (such as an empty
 * string or a number ending in a decimal point), but the value should only be applied to a model of type `number` when it actually is a valid number.
 * options.set() is only called with validated values.
 */
export function useValidatedModel<Value>(options: { get: () => Value; set: (newValue: Value) => void; validators: Array<(value: Value) => (string | undefined)> }): Ref<Value> {
	const internalValue = ref(options.get());
	watch(() => options.get(), (val) => {
		internalValue.value = val;
	});
	return computed({
		get: () => internalValue.value,
		set: (val: Value) => {
			internalValue.value = val;
			if (options.validators.every((v) => v(val) == null)) {
				options.set(val);
			}
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

/**
 * Allows to run multiple cleanup functions in watchers. Due to https://github.com/vuejs/core/issues/3341, only the last
 * onCleanup function specified is called. Call this with the onCleanup function given by the watcher and register
 * multiple cleanup callbacks by calling the onCleanup method returned by this function.
 */
export function fixOnCleanup(onCleanup: (cleanupFn: () => void) => void): (cleanupFn: () => void) => void {
	const cleanupFns: Array<() => void> = [];
	onCleanup(() => {
		for (const cleanupFn of cleanupFns) {
			cleanupFn();
		}
	});

	return (cleanupFn: () => void) => {
		cleanupFns.push(cleanupFn);
	};
}

export function computedAsync<T>(getter: ComputedGetter<Promise<T>>, onError = (err: any) => { console.error(err); }): Ref<T | undefined> {
	const promise = computed(getter);
	const val = ref<T>();
	watch(promise, (p) => {
		val.value = undefined;
		p.then((v) => {
			if (promise.value === p) {
				val.value = v;
			}
		}).catch(onError);
	}, { immediate: true });
	return val;
}

export const vHtmlAsync: Directive<Element, Promise<string>> = (el, binding) => {
	const html = computedAsync(() => binding.value);

	watch(() => html.value, (val) => {
		el.innerHTML = val ?? "";
	});
};

export function useIsMounted(): Readonly<Ref<boolean>> {
	const isMounted = ref(false);
	onMounted(() => {
		isMounted.value = true;
	});
	onBeforeUnmount(() => {
		isMounted.value = false;
	});
	return readonly(isMounted);
}

/**
 * Will return a ref to a deep clone of the given ref. When the given model ref is updated, a deep clone is applied
 * to the returned ref. When the returned ref is updated (deep watch), a deep clone is applied to the model ref.
 * Use this as `useImmutableModel(defineModel(...))` to allow changing nested properties of the model without mutating
 * the actual object passed as the model value.
 */
export function useImmutableModel<T>(modelRef: Ref<T>): Ref<T> {
	const value = ref() as Ref<T>;
	watch(modelRef, () => {
		value.value = cloneDeep(modelRef.value);
	}, { immediate: true });
	watch(value, () => {
		if (!isEqual(toRaw(value.value), toRaw(modelRef.value))) {
			modelRef.value = cloneDeep(value.value);
		}
	}, { deep: true });
	return value;
}