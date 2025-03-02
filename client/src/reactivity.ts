// https://stackoverflow.com/a/49579497/242365
type IfEquals<X, Y, A, B> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? A : B;
export type WritableKeysOf<T> = { [P in keyof T]-?: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, P, never> }[keyof T];
export type DeletableKeysOf<T> = { [K in WritableKeysOf<T>]: {} extends Pick<T, K> ? K : never }[WritableKeysOf<T>];

/**
 * Provides a generic reactivity implementation that should be adaptable to most reactivity frameworks (such as Vue and React).
 *
 * Providers of reactive objects should create those objects using ReactiveObjectProvider.create(). Changes to values anywhere
 * inside the reactive objects should only be made using ReactiveObjectProvider.set() and ReactiveObjectProvider.delete(), never
 * on the objects directly. This approach resembles the reactivity mechanism of Vue 2.
 *
 * Users of reactive objects can subscribe to changes using ReactiveObjectProvider.subscribe() and ReactiveObjectProvider().select().
 * They will only be notified about changes within the scope of the provider.
 *
 * Apps using reactive objects can use custom reactive object providers, for example by extending the DefaultReactiveObjectProvider
 * class. For example, an implementation for Vue 3 might want to override ReactiveObjectProvider.create() to return reactive({}).
 * Custom reactive object providers can be passed to the constructor options of the respective classes.
 */
export interface ReactiveObjectProvider {
	/**
	 * Returns a reactive version of the provided object.
	 */
	makeReactive: <T extends Record<any, any>>(object: T) => T;

	/**
	 * Returns a non-reactive version of the provided object. This non-reactive object should have the ability to be a property of
	 * a reactive object without its own properties being reactive.
	 */
	makeUnreactive: <T extends Record<any, any>>(object: T) => T;

	/**
	 * Sets an object property.
	 */
	set: <T extends Record<any, any>, K extends WritableKeysOf<T>>(object: T, key: K, value: T[K]) => void;

	/**
	 * Deletes an object property.
	 */
	delete: <T extends Record<any, any>>(object: T, key: DeletableKeysOf<T>) => void;

	/**
	 * Calls the given callback every time any value in the scope of the reactive object provider changes.
	 * Inside the callback, isReactiveObjectUpdate() and isReactivePropertyUpdate() may be used to determine what exactly
	 * has changed.
	 * @returns A callback to unsubscribe the callback.
	 */
	subscribe: (callback: ReactiveObjectSubscription) => () => void;

	/**
	 * Calls the given callback with the result of the selector. The selector is called again every time any value in the
	 * scope of the reactive object provider changes. If its result is different than the previous time, the callback is
	 * called with the new result.
	 * @param isEqual A callback that returns whether the previous selector result is equal to the current one. If it is,
	 *     the callback is not called. Defaults to a strict equality check.
	 */
	select<T>(selector: () => T, callback: (value: T) => void, isEqual?: (a: T, b: T) => boolean): () => void;
}

export type ReactiveObjectUpdate<T = any, K extends keyof T = keyof T> = {
	object: T;
	key: K;
} & ({ action: "set"; value: T[K] } | { action: "delete" });

export type ReactiveObjectSubscription = (update: ReactiveObjectUpdate) => void;

export class DefaultReactiveObjectProvider implements ReactiveObjectProvider {
	protected _subscriptions: Array<ReactiveObjectSubscription> = [];

	protected _notify(update: ReactiveObjectUpdate): void {
		for (const subscription of this._subscriptions) {
			subscription(update);
		}
	}

	makeReactive<T extends Record<any, any>>(object: T): T {
		return object;
	}

	makeUnreactive<T extends Record<any, any>>(object: T): T {
		return object;
	}

	set<T extends Record<any, any>, K extends WritableKeysOf<T>>(object: T, key: K, value: T[K]): void {
		object[key] = value;
		this._notify({ action: "set", object, key, value });
	}

	delete<T extends Record<any, any>>(object: T, key: DeletableKeysOf<T>): void {
		delete object[key];
		this._notify({ action: "delete", object, key });
	}

	subscribe(callback: ReactiveObjectSubscription): () => void {
		this._subscriptions.push(callback);
		let unsubscribed = false;
		return () => {
			if (!unsubscribed) {
				const idx = this._subscriptions.indexOf(callback);
				if (idx !== -1) {
					this._subscriptions.splice(idx, 1);
				}
				unsubscribed = true;
			}
		};
	}

	select<T>(selector: () => T, callback: (value: T) => void, isEqual: (a: T, b: T) => boolean = (a, b) => a === b): () => void {
		let value = selector();
		callback(value);
		return this.subscribe(() => {
			const oldValue = value;
			value = selector();
			if (!isEqual(oldValue, value)) {
				callback(value);
			}
		});
	}
}

/**
 * Returns true if the given update is creates/updates/deletes a property of the given object.
 */
export function isReactiveObjectUpdate<T>(update: ReactiveObjectUpdate<any, any>, object: T): update is ReactiveObjectUpdate<T, keyof T> {
	return update.object === object;
}

/**
 * Returns true if the given update creates/updates/deletes the property with the given key on the given object.
 */
export function isReactivePropertyUpdate<T, K extends keyof T>(update: ReactiveObjectUpdate<any, any>, object: T, key: K): update is ReactiveObjectUpdate<T, K> {
	return update.object === object && update.key === key;
}

/**
 * Defines a getter in "object" for each property of "data". Through the reactivity provider, changes on "data" are
 * detected and getters are defined for any properties added later.
 * This allows non-reactive "object" to become a view for reactive "data".
 */
export function _defineDynamicGetters(object: any, data: any, reactiveObjectProvider: ReactiveObjectProvider): void {
	for (const key of Object.keys(data)) {
		void Object.defineProperty(object, key, {
			get: () => data[key]
		});
	}
	reactiveObjectProvider.subscribe((update) => {
		if (update.action === "set" && update.object === data && !Object.prototype.hasOwnProperty.call(object, update.key)) {
			void Object.defineProperty(object, update.key, {
				get: () => data[update.key],
				configurable: true,
				enumerable: true
			});
		}
	});
}