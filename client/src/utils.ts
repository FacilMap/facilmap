import type { EventHandler, EventName, TrackPoint, TrackPoints } from "facilmap-types";

export type IterableType<I extends AsyncIterable<any>> = I extends AsyncIterable<infer T> ? T : never;

export async function* flatMapAsyncIterable<I extends AsyncIterable<any>, O>(iterable: I, mapper: (it: IterableType<I>) => (O[] | Promise<O[]>)): AsyncGenerator<O, void, undefined> {
	for await (const it of iterable) {
		for (const o of await mapper(it)) {
			yield o;
		}
	}
}

export function mapAsyncIterable<I extends AsyncIterable<any>, O>(iterable: I, mapper: (it: IterableType<I>) => (O | Promise<O>)): AsyncGenerator<O, void, undefined> {
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
): AsyncGenerator<IterableType<I> extends { type: "mapData" } ? IterableType<I> : O, void, undefined> {
	return mapAsyncIterable(iterable, async (obj) => {
		return obj.type === "mapData" ? obj as any : await mapper(obj as any);
	});
}

export function mergeTrackPoints(existingTrackPoints: Record<number, TrackPoint> | null, newTrackPoints: TrackPoint[]): TrackPoints {
	const ret = { ...(existingTrackPoints || { }) } as TrackPoints;

	for(let i=0; i<newTrackPoints.length; i++) {
		ret[newTrackPoints[i].idx] = newTrackPoints[i];
	}

	ret.length = 0;
	for(const i in ret) {
		if(i != "length")
			ret.length = Math.max(ret.length, parseInt(i) + 1);
	}

	return ret;
}

export function mergeEventHandlers<Events extends Record<string, any[]>>(...handlers: Array<{ [E in EventName<Events>]?: EventHandler<Events, E> }>): { [E in EventName<Events>]?: EventHandler<Events, E> } {
	return Object.fromEntries([...new Set(handlers.flatMap((h) => Object.keys(h)))].map((eventName) => [eventName as any, (...args: any[]) => {
		for (const h of handlers) {
			if (Object.prototype.hasOwnProperty.call(h, eventName) && h[eventName]) {
				(h as any)[eventName](...args);
			}
		}
	}]));
}