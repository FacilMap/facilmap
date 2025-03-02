import { DefaultReactiveObjectProvider } from "facilmap-client";
import { cloneDeep, isEqual } from "lodash-es";
import { type ComponentPublicInstance, type DeepReadonly, type Directive, type Ref, computed, onScopeDispose, readonly, ref, shallowReadonly, shallowRef, watch, type ComputedGetter, type Component, type VNodeProps, type AllowedComponentProps, onBeforeUnmount, onMounted, toRaw, reactive, type DebuggerOptions, type ComputedRef, type WatchSource, toValue } from "vue";
// eslint-disable-next-line vue/prefer-import-from-vue, import/no-extraneous-dependencies
import { pauseTracking, resetTracking } from "@vue/reactivity";

// https://stackoverflow.com/a/73784241/242365
export type ComponentProps<C extends Component> = C extends new (...args: any) => any
  ? Omit<InstanceType<C>['$props'], keyof VNodeProps | keyof AllowedComponentProps>
  : never;

/**
 * A directive that scrolls its element into view when its binding value becomes true.
 */
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
 * A ref that maintains an internal state that can be overridden by a specified prop. Changing the value will both change the internal state
 * and emit an event.
 * This allows specifying hybrid stateful/stateless components, where the prop is used when specified and otherwise the internal state.
 * @param fallbackValue The initial value of the internal state if the prop is not defined. If the prop is defined, its current value will
 *     be used as the initial value instead.
 * @param getProp Should return the value of the prop. If this returns a value, it is used. If this returns undefined, the prop is assumed
 *     to not be defined and the value of the internal state is returned.
 * @param onUpdate Should emit the change event. Called when the value changes, in addition to updating the internal state.
 * @returns A computed ref with a setter.
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
 * Returns a ref callback that allows storing an element ref inside a map of refs.
 * This can be used to keep multiple refs, for example for a list of elements that is dynamically generated. The refs will be stored in a
 * map = reactive(new Map<Key, Element | ComponentPublicInstance>), where Key is a unique identifier for each item in the collection.
 * This should be used on the elements as :ref="mapRef(map, key)". It will maintain a ref for each rendered element by its key in the map.
 */
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

export class VueReactiveObjectProvider extends DefaultReactiveObjectProvider {
	override makeReactive<T extends Record<any, any>>(object: T): T {
		return reactive(object);
	}
}

/**
 * Like Vue's onCleanup, but provides an onCleanup callback that allows running code before a new value is calculated or the scope is disposed.
 */
export function computedWithCleanup<T>(getter: ((oldValue: T | undefined, onCleanup: (cleanupFn: () => void) => void) => T), debugOptions?: DebuggerOptions): ComputedRef<T> {
	let cleanupStack: Array<() => void> = [];
	const cleanup = () => {
		for (const c of cleanupStack) {
			c();
		}
		cleanupStack = [];
	};

	onScopeDispose(() => {
		cleanup();
	});

	return computed((oldValue) => {
		cleanup();

		return getter(oldValue, (cleanupFn) => {
			cleanupStack.push(cleanupFn);
		});
	}, debugOptions);
}

/**
 * Calls the given callback while temporarily disabling reactivity tracking. This allows more explicit dependency management in reactive
 * effects or computed properties.
 */
export function withoutTracking<R>(callback: () => R): R {
	try {
		pauseTracking();
		return callback();
	} finally {
		resetTracking();
	}
}

type ComputedWithDepsCallback<D, OV, R> = (deps: D, oldValue: OV, onCleanup: (cleanupFn: () => void) => void) => R;
/**
 * Returns a computed ref whose dependencies are not automatically inferred but specified like for a watcher.
 */
// Types mostly copied from Vue watch()
export function computedWithDeps<T, R>(source: WatchSource<T>, cb: ComputedWithDepsCallback<T, R | undefined, R>, debugOptions?: DebuggerOptions): ComputedRef<R>;
export function computedWithDeps<T extends ReadonlyArray<WatchSource<unknown>>, R>(sources: [...T], cb: ComputedWithDepsCallback<{ [K in keyof T]: T[K] extends WatchSource<infer V> ? V : T[K] extends object ? T[K] : never }, R | undefined, R>, debugOptions?: DebuggerOptions): ComputedRef<R>;
export function computedWithDeps<T extends object, R>(source: T, cb: ComputedWithDepsCallback<T, R | undefined, R>, debugOptions?: DebuggerOptions): ComputedRef<R> {
	return computedWithCleanup((oldValue, onCleanup) => {
		const values = Array.isArray(source) ? source.map((s) => toValue(s)) : toValue(source);
		return withoutTracking(() => cb(values as any, oldValue, onCleanup));
	});
}

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