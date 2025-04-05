import { cloneDeep as originalCloneDeep, isEqual, partition, sortBy } from "lodash-es";
import decodeURIComponent from "decode-uri-component";
import type { Colour, DeepMutable, DeepReadonly } from "facilmap-types";
import type { OsmFeatureType } from "osm-api";
import { getI18n } from "./i18n";

export function quoteHtml(str: string | number): string {
	return `${str}`
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
		.replace(/\n/g, "&#10;")
		.replace(/\r/g, "&#13;")
		.replace(/\t/g, "&#9;");
}

export function quoteRegExp(str: string): string {
	return `${str}`.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
}

export function quoteMarkdown(str: string): string {
	return str.split("").map((c) => `&#${c.charCodeAt(0)};`).join("");
}

export function makeTextColour(backgroundColour: string, threshold = 0.5): string {
	return (getBrightness(backgroundColour) <= threshold) ? "#ffffff" : "#000000";
}

export function getBrightness(colour: string): number {
	colour = colour.replace(/^#/, '');
	const r = parseInt(colour.substr(0, 2), 16)/255;
	const g = parseInt(colour.substr(2, 2), 16)/255;
	const b = parseInt(colour.substr(4, 2), 16)/255;
	// See http://stackoverflow.com/a/596243/242365
	return Math.sqrt(0.241*r*r + 0.691*g*g + 0.068*b*b);
}

export function isBright(colour: string): boolean {
	return getBrightness(colour) > 0.7;
}

export function overwriteObject(from: Record<keyof any, any>, to: Record<keyof any, any>): void {
	for(const i in to)
		delete to[i];
	for(const i in from)
		to[i] = from[i];
}

/**
 * Converts an object { entry: { subentry: "value" } } into { "entry.subentry": "value" }
 * @param obj {Object}
 * @return {Object}
 */
export function flattenObject(obj: Record<keyof any, any>, _prefix = ""): Record<keyof any, any> {
	const ret: Record<keyof any, any> = { };
	for(const i in obj) {
		if(typeof obj[i] == "object")
			Object.assign(ret, flattenObject(obj[i], _prefix + i + "."));
		else
			ret[_prefix + i] = obj[i];
	}

	return ret;
}

export interface ObjectDiffItem {
	index: string;
	before: any;
	after: any;
}

export function getObjectDiff(obj1: Record<keyof any, any>, obj2: Record<keyof any, any>): Array<ObjectDiffItem> {
	const flat1 = flattenObject(obj1);
	const flat2 = flattenObject(obj2);

	const ret: Array<ObjectDiffItem> = [ ];

	for(const i in flat1) {
		if(flat1[i] != flat2[i] && !(!flat1[i] && !flat2[i]))
			ret.push({ index: i, before: flat1[i], after: flat2[i] });
	}

	for(const i in flat2) {
		if(!(i in flat1) && !(!flat1[i] && !flat2[i]))
			ret.push({ index: i, before: undefined, after: flat2[i] });
	}

	return ret;
}

export function decodeQueryString(str: string): Record<string, string> {
	const obj: Record<string, string> = { };
	for(const segment of str.replace(/^\?/, "").split(/[;&]/)) {
		if (segment !== "") {
			const pair = segment.split("=");
			obj[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] ?? "");
		}
	}
	return obj;
}

export function encodeQueryString(obj: Record<string, string>): string {
	const pairs = [ ];
	for(const i in obj) {
		pairs.push(encodeURIComponent(i) + "=" + encodeURIComponent(obj[i]));
	}
	return pairs.join("&");
}

export function* numberKeys(obj: Record<number, any>): Iterable<number> {
	for (const idx of Object.keys(obj)) {
		// https://stackoverflow.com/a/175787/242365
		const number = Number(idx);
		if (!isNaN(number) && !isNaN(parseFloat(idx)))
			yield number;
	}
}

export function* numberEntries<V>(obj: Record<number, V>): Iterable<[number, V]> {
	for (const [k, v] of Object.entries(obj)) {
		const number = Number(k);
		if (!isNaN(number) && !isNaN(parseFloat(k)))
			yield [number, v];
	}
}

export function getProperty<K, V, T extends Map<K, V>>(obj: T, key: K): V;
export function getProperty<T, K extends keyof T>(obj: T, key: K): T[K];
export function getProperty(obj: any, key: any): any {
	if (Object.getPrototypeOf(obj)?.get)// This is an ES6 map
		return obj.get(key);
	else
		return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : (undefined as any);
}

export async function sleep(ms: number): Promise<void> {
	await new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});
}

/**
 * Performs a 3-way merge. Takes the difference between oldObject and newObject and applies it directly to targetObject.
 */
export function mergeObject<T extends Record<keyof any, any>>(oldObject: NoInfer<T> | DeepReadonly<NoInfer<T>> | undefined, newObject: NoInfer<T> | DeepReadonly<NoInfer<T>>, targetObject: T): void {
	// Code below does not work well with DeepReadonly types
	const oldObject_ = oldObject as T | undefined;
	const newObject_ = newObject as T;

	for(const i of new Set([...oldObject_ ? Object.keys(oldObject_) : [], ...Object.keys(newObject_)] as Array<keyof T>)) {
		if (!Object.prototype.hasOwnProperty.call(newObject_, i)) {
			delete targetObject[i];
		} else if (
			typeof newObject_[i] == "object" && newObject_[i] != null
			&& Object.prototype.hasOwnProperty.call(targetObject, i) && typeof targetObject[i] == "object" && targetObject[i] != null
		) {
			mergeObject(oldObject_?.[i], newObject_[i], targetObject[i]);
		} else if (oldObject_ == null || !isEqual(oldObject_[i], newObject_[i])) {
			targetObject[i] = cloneDeep(newObject_[i]);
		}
	}
}

/**
 * Performs a 3-way merge. Takes the difference between oldArray and newArray and applies it directly to targetArray.
 */
export function mergeArray<T extends Record<keyof any, any>, K>(oldArray: DeepReadonly<Array<NoInfer<T>>> | undefined, newArray: DeepReadonly<Array<NoInfer<T>>>, targetArray: T[], getKey: (item: DeepReadonly<T> | T) => K): void {
	const getItems = (arr: ReadonlyArray<T | DeepReadonly<T>>) => {
		const result = new Map<K, Array<{ idx: number; obj: T | DeepReadonly<T> }>>();
		for (let i = 0; i < arr.length; i++) {
			const key = getKey(arr[i]);
			const item = { idx: i, obj: arr[i] };
			if (!result.has(key)) {
				result.set(key, [item]);
			} else {
				result.get(key)!.push(item);
			}
		}
		return [...result.entries()].flatMap(([key, items]) => items.map((item, i) => ({ ...item, key: [key, i] as const })));
	};

	const isKey = (a: { key: readonly [K, number] }) => (b: { key: readonly [K, number] }) => a.key[0] === b.key[0] && a.key[1] === b.key[1];

	const oldItems = oldArray ? getItems(oldArray) : [];
	const newItems = getItems(newArray);
	const targetItems = getItems(targetArray);

	const [deletedItems, keptItemsOld] = partition(oldItems, (oldItem) => !newItems.some(isKey(oldItem)));
	const createdItems = newItems.filter((newItem) => !oldItems.some(isKey(newItem)));

	for (const oldItem of keptItemsOld) {
		const targetItem = targetItems.find(isKey(oldItem));
		if (targetItem) {
			const newItem = newItems.find((newItem) => oldItem.key[0] === newItem.key[0] && oldItem.key[1] === newItem.key[1])!;
			// This already sets the new properties in the obj, but that's okay
			mergeObject(oldItem, newItem, targetItem);
		}
	}

	for (const deletedItem of deletedItems) {
		const targetItemIdx = targetItems.findIndex(isKey(deletedItem));
		if (targetItemIdx !== -1) {
			targetItems.splice(targetItemIdx, 1);
		}
	}

	targetItems.push(...createdItems);

	const result = sortBy(targetItems, (item) => item.idx).map((item) => item.obj);
	if (targetArray.length > result.length) {
		targetArray.splice(result.length, targetArray.length - result.length);
	}

	for (let i = 0; i < result.length; i++) {
		targetArray[i] = cloneDeep(result[i]) as T;
	}
}

export function getSafeFilename(fname: string): string {
	return fname.replace(/[\\/:*?"<>|]+/g, '_');
}

export function parseMapUrl(url: string, baseUrl: string): { mapSlug: string; hash: string } | undefined {
	if (url.startsWith(baseUrl)) {
		const m = url.slice(baseUrl.length).match(/^([^/]+)(\/table)?(\?|#|$)/);

		if (m) {
			const hashIdx = url.indexOf("#");
			return {
				mapSlug: decodeURIComponent(m[1]),
				hash: hashIdx === -1 ? "" : url.substr(hashIdx)
			};
		}
	}
}

export class RetryError extends Error {
	constructor(public cause: Error) {
		super();
	}
}

export function throttledBatch<Args extends any[], Result>(
	getBatch: (batch: Args[]) => Promise<Result[]>,
	{ delayMs, maxSize, maxRetries = 3, noParallel = false }: {
		delayMs: number | (() => number);
		maxSize: number | (() => number);
		maxRetries?: number;
		noParallel?: boolean;
	}
): ((...args: Args) => Promise<Result>) {
	let lastTime = -Infinity;
	let isScheduled = false;
	let batch: Array<{ args: Args; resolve: (result: Result) => void; reject: (err: any) => void; retryAttempt: number }> = [];

	const handleBatch = () => {
		lastTime = Date.now();
		isScheduled = false;

		const thisBatch = batch.splice(0, typeof maxSize === "function" ? maxSize() : maxSize);
		getBatch(thisBatch.map((it) => it.args)).then((results) => {
			for (let i = 0; i < thisBatch.length; i++) {
				thisBatch[i].resolve(results[i]);
			}
		}).catch((err) => {
			if (err instanceof RetryError) {
				for (const { reject } of thisBatch.filter((it) => it.retryAttempt >= maxRetries)) {
					reject(err.cause);
				}
				batch.splice(0, 0, ...thisBatch.filter((it) => it.retryAttempt < maxRetries).map((it) => ({ ...it, retryAttempt: it.retryAttempt + 1 })));
			} else {
				for (const { reject } of thisBatch) {
					reject(err);
				}
			}
		}).finally(() => {
			schedule();
		});

		if (!noParallel) {
			schedule();
		}
	};

	const schedule = () => {
		if (!isScheduled && batch.length > 0) {
			const delay = typeof delayMs === "function" ? delayMs() : delayMs;
			setTimeout(handleBatch, Math.max(0, lastTime + delay - Date.now()));
			isScheduled = true;
		}
	};

	return async (...args) => {
		return await new Promise<Result>((resolve, reject) => {
			batch.push({ args, resolve, reject, retryAttempt: 0 });
			schedule();
		});
	};
}

/**
 * Given a list of objects whose order is defined by an index field, returns how the index field of each object needs to be updated
 * in order to create a new item at the given index (id === undefined) or move an existing item to the new index (id !== undefined).
 */
export function insertIdx<IDType>(objects: Array<{ id: IDType; idx: number }>, id: IDType | undefined, insertAtIdx: number): Array<{ id: IDType; oldIdx: number; newIdx: number }> {
	const result = objects.map((obj) => ({ id: obj.id, oldIdx: obj.idx, newIdx: obj.idx }));

	const insert = (thisId: IDType | undefined, thisIdx: number) => {
		for (const obj of result) {
			if ((thisId == null || obj.id !== thisId) && obj.newIdx === thisIdx) {
				insert(obj.id, obj.newIdx + 1);
				obj.newIdx++;
			}
		}
	};
	insert(id, insertAtIdx);

	if (id != null) {
		for (const obj of result) {
			if (obj.id === id) {
				obj.newIdx = insertAtIdx;
			}
		}
	}

	return result;
}

/**
 * Can be used in the form of fetch(...).then(validateResponse) to throw an error if the fetch succeeded with a non-ok status code.
 */
export async function validateResponse(response: Response): Promise<Response> {
	if (!response.ok) {
		let body;
		try {
			body = await response.text();
		} catch {
			// Ignore
		}
		throw new Error(`Error loading ${response.url} (status ${response.status}${body ? `, body: ${body}` : ""})`);
	}
	return response;
}

export type OnProgress = {
	signal?: AbortSignal;
	onProgress?: (progress: number) => void;
};

export function scaleProgress(onProgress: OnProgress | undefined, min: number, max: number): OnProgress {
	return {
		signal: onProgress?.signal,
		onProgress: onProgress?.onProgress && ((p) => onProgress.onProgress!(min + (p * (max - min))))
	};
}

export function sendProgress(onProgress: OnProgress | undefined, progress: number): void {
	if (progress < 0 || progress > 1) {
		console.trace("Unexpected progress", progress);
	}
	onProgress?.signal?.throwIfAborted();
	onProgress?.onProgress?.(progress);
}

export function getOsmFeatureName(tags: Record<string, string>, language: string): string | undefined {
	const lowerTags = Object.fromEntries(Object.entries(tags).map(([k, v]) => [k.toLowerCase(), v]));
	const lowerLang = language.toLowerCase();
	return lowerTags[`name:${lowerLang}`] ?? tags[`name:${lowerLang.split("-")[0]}`] ?? tags.name;
}

export function getOsmFeatureUrl(...args: [type: OsmFeatureType | "changeset", id: number] | [type: "user", name: string]): string {
	return `https://www.openstreetmap.org/${encodeURIComponent(args[0])}/${encodeURIComponent(args[1])}`;
}

export function getOsmFeatureLabel(type: OsmFeatureType, id: number, name?: string, role?: string): string {
	const i18n = getI18n();
	const feature = (
		type === "node" ? i18n.t("utils.node", { id }) :
		type === "way" ? i18n.t("utils.way", { id }) :
		type === "relation" ? i18n.t("utils.relation", { id }) :
		`${id}`
	);
	if (name && role) {
		return i18n.t("utils.feature-with-name-role", { feature, name, role });
	} else if (name) {
		return i18n.t("utils.feature-with-name", { feature, name });
	} else if (role) {
		return i18n.t("utils.feature-with-role", { feature, role });
	} else {
		return feature;
	}
}

function* generateUniqueColourParts(): Generator<number, void, void> {
	yield 255;
	yield 0;
	for (let fac = 2; true; fac *= 2) {
		const frac = 256 / fac;
		for (let i = fac - 1; i > 0; i -= 2) {
			yield Math.round(i * frac);
		}
	}
}

export function* generateUniqueColours(): Generator<Colour, void, void> {
	let prevLength = 0;
	let parts: number[] = [];
	const gen = generateUniqueColourParts();
	while (true) {
		parts.push(gen.next().value!);
		for (let i = 0; i < parts.length; i++) {
			for (let j = 0; j < parts.length; j++) {
				for (let k = 0; k < parts.length; k++) {
					if (i < prevLength && j < prevLength && k < prevLength) { // We have yielded this combination before
						continue;
					}

					if ((parts[i] === 0 && parts[j] === 0 && parts[k] === 0) || (parts[i] === 255 && parts[j] === 255 && parts[k] === 255)) { // Skip these, they are not colours
						continue;
					}

					yield `${parts[i].toString(16).padStart(2, "0")}${parts[j].toString(16).padStart(2, "0")}${parts[k].toString(16).padStart(2, "0")}`;
				}
			}
		}
		prevLength = parts.length;
	}
}

export function concatArrayBuffers(chunks: Uint8Array[]): Uint8Array {
	const result = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}
	return result;
}

export function cloneDeep<T>(value: T): DeepMutable<T> {
	// https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/70545
	return originalCloneDeep(value) as DeepMutable<T>;
}