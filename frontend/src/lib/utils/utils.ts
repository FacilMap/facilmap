import { isEqual } from "lodash-es";
import { clone } from "facilmap-utils";
import type { Field, Line, Marker, Type } from "facilmap-types";
import type { Emitter } from "mitt";
import { DeepReadonly, Ref, onBeforeUnmount, onMounted, watchEffect } from "vue";

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// https://stackoverflow.com/a/62085569/242365
export type DistributedKeyOf<T> = T extends any ? keyof T : never;

/**
 * Performs a 3-way merge. Takes the difference between oldObject and newObject and applies it to targetObject.
 * @param oldObject {Object}
 * @param newObject {Object}
 * @param targetObject {Object}
 */
export function mergeObject<T extends Record<keyof any, any>>(oldObject: T | undefined, newObject: T, targetObject: T): void {
	for(const i of new Set<keyof T & (number | string)>([...Object.keys(newObject), ...Object.keys(targetObject)])) {
		if(
			Object.prototype.hasOwnProperty.call(newObject, i) && typeof newObject[i] == "object" && newObject[i] != null
			&& Object.prototype.hasOwnProperty.call(targetObject, i) && typeof targetObject[i] == "object" && targetObject[i] != null
		)
			mergeObject(oldObject && oldObject[i], newObject[i], targetObject[i]);
		else if(oldObject == null || !isEqual(oldObject[i], newObject[i]))
			targetObject[i] = clone(newObject[i]);
	}
}

export function canControl<T extends Marker | Line = Marker | Line>(type: Type, ignoreField?: Field | null): Array<T extends any ? keyof T : never /* https://stackoverflow.com/a/62085569/242365 */> {
	const props: string[] = type.type == "marker" ? ["colour", "size", "symbol", "shape"] : type.type == "line" ? ["colour", "width", "mode"] : [];
	return props.filter((prop) => {
		if((type as any)[prop+"Fixed"] && ignoreField !== null)
			return false;

		const idx = "control"+prop.charAt(0).toUpperCase() + prop.slice(1);
		for (const field of type.fields) {
			if ((field as any)[idx] && (!ignoreField || field !== ignoreField))
				return false;
		}
		return true;
	}) as Array<T extends any ? keyof T : never>;
}


let idCounter = 1;

export function getUniqueId(scope = ""): string {
	return `${scope ? `${scope}-` : ""}${idCounter++}`;
}

export function isMarker(object: Marker | Line): object is Marker {
	return "lat" in object && object.lat != null;
}

export function isLine(object: Marker | Line): object is Line {
	return "top" in object && object.top != null;
}

export function isPromise(object: any): object is Promise<unknown> {
	return typeof object === 'object' && 'then' in object && typeof object.then === 'function';
}

export function useEventListener<EventMap extends Record<string, unknown>, EventType extends keyof EventMap>(emitter: Ref<Emitter<EventMap> | DeepReadonly<Emitter<EventMap>> | undefined>, type: EventType, listener: (data: EventMap[EventType]) => void): void {
	watchEffect((onCleanup) => {
		if (emitter.value) {
			const val = emitter.value;
			val.on(type, listener);
			onCleanup(() => {
				val.off(type, listener);
			});
		}
	});
}

export function useDomEventListener<Element extends EventTarget, Args extends Parameters<Element["addEventListener"]>>(element: EventTarget, ...args: Args): void {
	onMounted(() => {
		(element as any).addEventListener(...args);
	});

	onBeforeUnmount(() => {
		(element as any).removeEventListener(...args);
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
		return "Must not be empty.";
	}
}
