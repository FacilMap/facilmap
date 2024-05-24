export interface ReactiveObjectProvider {
	create: <T extends Record<any, any>>(object: T) => T;
	set: <T extends Record<any, any>, K extends keyof T>(object: T, key: K, value: T[K]) => void;
	delete: <T extends Record<any, any>>(object: T, key: keyof { [K in keyof T]: {} extends Pick<T, K> ? K : never }) => void;
	subscribe: (callback: () => void) => () => void;
}

export type ReactiveObjectSubscription = <T extends Record<any, any>, K extends keyof T>(
	...args: [action: "set", object: T, key: K, value: T[K]] | [action: "delete", object: T, key: K]
) => void;

export class DefaultReactiveObjectProvider implements ReactiveObjectProvider {
	protected _subscriptions: Array<ReactiveObjectSubscription> = [];

	protected _notify(...args: Parameters<ReactiveObjectSubscription>): void {
		for (const subscription of this._subscriptions) {
			subscription(...args);
		}
	}

	create<T extends Record<any, any>>(object: T): T {
		return object;
	}

	set<T extends Record<any, any>, K extends keyof T>(object: T, key: K, value: T[K]): void {
		object[key] = value;
		this._notify("set", object, key, value);
	}

	delete<T extends Record<any, any>>(object: T, key: keyof { [K in keyof T]: {} extends Pick<T, K> ? K : never }): void {
		delete object[key];
		this._notify("delete", object, key);
	}

	/**
	 * Calls the given callback every time any value in the scope of the reactive object provider changes.
	 * @returns A callback to unsubscribe the callback.
	 */
	subscribe(callback: () => void): () => void {
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

	/**
	 * Calls the given callback with the result of the selector. The selector is called again every time any value in the
	 * scope of the reactive object provider changes. If its result is different than the previous time, the callback is
	 * called with the new result.
	 * @param isEqual A callback that returns whether the previous selector result is equal to the current one. If it is,
	 *     the callback is not called. Defaults to a strict equality check.
	 */
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

export let getReactiveObjectProvider = (): ReactiveObjectProvider => new DefaultReactiveObjectProvider();

export function setReactiveObjectProvider(getProvider: () => ReactiveObjectProvider): void {
	getReactiveObjectProvider = getProvider;
}