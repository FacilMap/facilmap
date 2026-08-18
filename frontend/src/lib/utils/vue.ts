import { DefaultReactiveObjectProvider } from "facilmap-client";
import { cloneDeep, isEqual, sortBy } from "lodash-es";
import { type ComponentPublicInstance, type DeepReadonly, type Directive, type Ref, computed, onScopeDispose, readonly, ref, shallowReadonly, shallowRef, watch, type ComputedGetter, type Component, type VNodeProps, type AllowedComponentProps, onBeforeUnmount, onMounted, toRaw, type FunctionDirective, effectScope, toRef, reactive, type DebuggerOptions, type ComputedRef, type WatchSource, toValue } from "vue";
// eslint-disable-next-line vue/prefer-import-from-vue, import/no-extraneous-dependencies
import { pauseTracking, resetTracking } from "@vue/reactivity";
import { shouldHandleGlobalShortcut, useDomEventListener, type AnyRef } from "./utils";

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
export function useRefWithOverride<Value>(fallbackValue: Value, override: Ref<Value | undefined>): Ref<Value> {
	const internalValue = ref(override.value ?? fallbackValue);
	return computed({
		get: (): Value => {
			return override.value !== undefined ? override.value : internalValue.value as Value;
		},
		set: (val: Value) => {
			internalValue.value = val as any;
			override.value = val;
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

/**
 * A wrapper for a custom function directive (the function is run on `mounted` and `updated`), but runs the function in an effect scope that is disposed on
 * `beforeUpdate` and `beforeUnmount` so that `onScopeDispose()` can be used.
 */
export function vDirectiveWithScope<HostElement = any, Value = any, Modifiers extends string = string, Arg extends string = string>(directive: FunctionDirective<HostElement, Value, Modifiers, Arg>): Directive<HostElement, Value, Modifiers, Arg> {
	const setup: FunctionDirective<HostElement, Value, Modifiers, Arg> = (el, binding, vnode, prevVNode) => {
		const scope = (el as any)._fmDirectiveScope = effectScope();
		scope.run(() => {
			directive(el, binding, vnode, prevVNode);
		});
	};

	const cleanup = (el: any) => {
		(el as any)._fmDirectiveScope?.stop();
	};

	return {
		mounted: setup,
		beforeUpdate: cleanup,
		updated: setup,
		beforeUnmount: cleanup
	};
}

export function useKeyboardShortcut(el: Ref<HTMLElement | undefined>, key: AnyRef<string[] | string | undefined>): void {
	const keyRef = toRef(key);
	const keys = computed(() => Array.isArray(keyRef.value) ? keyRef.value : keyRef.value ? [keyRef.value] : []);
	useDomEventListener(computed(() => keys.value.length > 0 ? document : undefined), "keydown", (e) => {
		// Do not check shift key, as arg might be an uppercase letter
		if (el.value && keys.value.includes(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey && shouldHandleGlobalShortcut(el.value, e)) {
			// Check whether the element is visible using offsetParent. It checks for display: none, see https://stackoverflow.com/a/53068496/242365
			// If it is not visible, for example when the button is in a search box tab that is not active, ignore the shortcut.
			// If the element is a dropdown menu, it should also work if the dropdown is closed, but only if the dropdown toggle is visible and enabled.
			const dropdownToggle = el.value.closest(".dropdown")?.querySelector<HTMLElement>(":scope > .dropdown-toggle");
			if (dropdownToggle ? (dropdownToggle.offsetParent && !(dropdownToggle as HTMLButtonElement).disabled && !dropdownToggle.classList.contains("disabled")) : el.value.offsetParent) {
				el.value.click();
			}
		}
	});
}

export const vKeyboardShortcut = vDirectiveWithScope<HTMLElement, string[] | string | undefined>((el, binding) => {
	const keys = Array.isArray(binding.value) ? binding.value : binding.value ? [binding.value] : [];
	useKeyboardShortcut(toRef(el), keys);

	// If the shortcut is a letter key and the letter is contained in the element text, wrap it in a <kbd> element to indicate the shortcut
	if (!el.querySelector("kbd")) {
		const letterKeys = keys.flatMap((k) => k.length === 1 ? [k.toLowerCase()] : []);
		if (letterKeys.length > 0) {
			const nodeIterator = document.createNodeIterator(el, NodeFilter.SHOW_TEXT);
			let currentNode: Text | null;
			while (currentNode = nodeIterator.nextNode() as Text | null) {
				const node = currentNode;

				const lowerText = node.data.toLowerCase();
				const positions = sortBy(letterKeys.map((k) => [k, lowerText.indexOf(k)] as const).filter(([k, i]) => i !== -1), ([k, i]) => i);
				if (positions.length > 0) {
					const text = node.data;

					node.data = text.slice(positions[0][1] + 1);

					const beforeNode = document.createTextNode(text.slice(0, positions[0][1]));
					node.parentNode!.insertBefore(beforeNode, node);

					const kbd = document.createElement("kbd");
					kbd.classList.add("fm-shortcut");
					kbd.appendChild(document.createTextNode(text.slice(positions[0][1], positions[0][1] + 1)));
					node.parentNode!.insertBefore(kbd, node);

					onScopeDispose(() => {
						beforeNode.remove();
						kbd.remove();
						node.data = text;
					});

					break;
				}
			}
		}
	}
});

export function getReactiveMediaQuery(query: string): Ref<boolean> {
	const update = ref(0);
	const match = matchMedia(query);
	match.addEventListener("change", () => {
		update.value++
	});
	return computed(() => {
		update.value;
		return match.matches;
	});
};

export const canHover = getReactiveMediaQuery("(hover: hover)");