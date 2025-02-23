import type { Emitter } from "mitt";
import { type DeepReadonly, type Ref, watchEffect, toRef, effectScope } from "vue";
import type * as z from "zod";
import { getI18n } from "./i18n";

// https://stackoverflow.com/a/62085569/242365
export type DistributedKeyOf<T> = T extends any ? keyof T : never;

export type DistributedOmit<T, K extends DistributedKeyOf<T>> = T extends any ? Omit<T, K> : never;

export type AnyRef<T> = T | Ref<T> | (() => T);


let idCounter = 1;

export function getUniqueId(scope = ""): string {
	return `${scope ? `${scope}-` : ""}${idCounter++}`;
}

export function useEventListener<EventMap extends Record<string, unknown>, EventType extends keyof EventMap>(emitter: AnyRef<Emitter<EventMap> | DeepReadonly<Emitter<EventMap>> | undefined>, type: EventType, listener: (data: EventMap[EventType]) => void): void {
	const emitterRef = toRef(emitter);

	watchEffect((onCleanup) => {
		if (emitterRef.value) {
			const val = emitterRef.value;
			val.on(type, listener);
			onCleanup(() => {
				val.off(type, listener);
			});
		}
	});
}

export function useDomEventListener<K extends string>(element: AnyRef<EventTarget | undefined>, type: K, listener: (this: HTMLElement, ev: K extends keyof HTMLElementEventMap ? HTMLElementEventMap[K] : K extends keyof WindowEventHandlersEventMap ? WindowEventHandlersEventMap[K] : Event) => any, options?: boolean | AddEventListenerOptions): void {
	watchEffect((onCleanup) => {
		const elementRef = toRef(element);
		if (elementRef.value) {
			const el = elementRef.value;
			el.addEventListener(type, listener as any, options);
			onCleanup(() => {
				el.removeEventListener(type, listener as any, options);
			});
		}
	});
}

/**
 * An event whose handler can be delayed in a similar fashion to the native ExtendableEvent
 * (https://developer.mozilla.org/en-US/docs/Web/API/ExtendableEvent/ExtendableEvent).
 * This enables a pattern described here: https://github.com/vuejs/vue/issues/5443#issuecomment-379284227
 * as a workaround for the fact that Vue event handlers cannot be async.
 */
export interface ExtendableEventMixin {
	waitUntil(promise: Promise<void>): void;
	_hasAwaited?: boolean;
	_promises?: Array<Promise<void>>;
	_awaitPromises(): Promise<void>;
}

export const extendableEventMixin: ExtendableEventMixin = {
	waitUntil(promise) {
		if (this._hasAwaited) {
			throw new Error("Cannot call waitUntil() after event has been processed.");
		} else if (this._promises) {
			this._promises.push(promise);
		} else {
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			this._promises = [promise];
		}
	},

	async _awaitPromises() {
		if (this._hasAwaited) {
			throw new Error("Event has already been awaited.");
		} else {
			this._hasAwaited = true;
			await Promise.all(this._promises ?? []);
		}
	}
}

export function validations<V>(val: V, funcs: Array<(val: V) => string | undefined>): string | undefined {
	for (const func of funcs) {
		const result = func(val);
		if (result) {
			return result;
		}
	}
	return undefined;
}

export function validateRequired(val: any): string | undefined {
	if (val == null || val === "") {
		return getI18n().t("utils.required-error");
	}
}

export function getZodValidator(validator: z.ZodType): (val: any) => string | undefined {
	return (val) => {
		if (val) {
			const result = validator.safeParse(val);
			if (!result.success) {
				return result.error.format()._errors.join("\n");
			}
		}
	};
}

/**
 * Registers a focus handler on the given element that does not fire when the focus was given through a click.
 */
export function useNonClickFocusHandler(element: AnyRef<HTMLElement | undefined>, onFocus: (e: FocusEvent) => void): void {
	let lastEvent: {
		timeout: ReturnType<typeof setTimeout>;
		hadMouseDown?: boolean;
		focusEvent?: FocusEvent;
	} | undefined;

	useDomEventListener(element, "mousedown", () => {
		lastEvent = {
			...lastEvent,
			timeout: lastEvent?.timeout ?? setTimeout(handleTimeout, 0),
			hadMouseDown: true
		};
	});

	useDomEventListener(element, "focus", (e: Event) => {
		lastEvent = {
			...lastEvent,
			timeout: lastEvent?.timeout ?? setTimeout(handleTimeout, 0),
			focusEvent: e as FocusEvent
		};
	});

	function handleTimeout() {
		if (lastEvent?.focusEvent && !lastEvent.hadMouseDown) {
			onFocus(lastEvent.focusEvent);
		}
		lastEvent = undefined;
	}
}

/**
 * Registers a click handler on the given element that does not fire when the click is caused by a drag.
 */
export function useNonDragClickHandler(element: AnyRef<HTMLElement | undefined>, onClick: (e: MouseEvent) => void): void {
	let hasMoved = false;

	useDomEventListener(element, "mousedown", () => {
		hasMoved = false;
		const scope = effectScope();
		scope.run(() => {
			useDomEventListener(document, "mousemove", () => {
				hasMoved = true;
			}, { capture: true });
			useDomEventListener(document, "mouseup", () => {
				scope.stop();
			}, { capture: true });
		});
	});

	useDomEventListener(element, "click", (e) => {
		if (!hasMoved) {
			onClick(e as MouseEvent);
		}
	});
}

export function useUnloadHandler(hasUnsavedModifications: AnyRef<boolean>): void {
	const hasUnsavedModificationsRef = toRef(hasUnsavedModifications);
	useDomEventListener(window, "beforeunload", (e) => {
		if (hasUnsavedModificationsRef.value) {
			e.preventDefault();
		}
	});
}