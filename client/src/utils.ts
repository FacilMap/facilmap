export type DistributiveOmit<T, K extends keyof T> = T extends any ? Omit<T, K> : never;

export type IterableType<I extends AsyncIterable<any>> = I extends AsyncIterable<infer T> ? T : never;

export async function* flatMapAsyncIterable<I extends AsyncIterable<any>, O>(iterable: I, mapper: (it: IterableType<I>) => (O[] | Promise<O[]>)): AsyncIterable<O> {
	for await (const it of iterable) {
		for (const o of await mapper(it)) {
			yield o;
		}
	}
}

export function mapAsyncIterable<I extends AsyncIterable<any>, O>(iterable: I, mapper: (it: IterableType<I>) => (O | Promise<O>)): AsyncIterable<O> {
	return flatMapAsyncIterable(iterable, async (it) => [await mapper(it)]);
}

export async function iterableToArray<I extends AsyncIterable<any>>(iterable: I): Promise<Array<IterableType<I>>> {
	const result: Array<I extends AsyncIterable<infer R> ? R : never> = [];
	for await (const it of iterable) {
		result.push(it);
	}
	return result;
}

export function mapNestedIterable<I extends AsyncIterable<{ type: string; data: any }>, O extends { type: string; data: any }>(
	iterable: I,
	mapper: (obj: Exclude<IterableType<I>, { type: "mapData" }>) => O | Promise<O>
): AsyncIterable<IterableType<I> extends { type: "mapData" } ? IterableType<I> : O> {
	return mapAsyncIterable(iterable, async (obj) => {
		return obj.type === "mapData" ? obj as any : await mapper(obj.data);
	});
}