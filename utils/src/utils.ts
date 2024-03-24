import { cloneDeep, isEqual } from "lodash-es";
import decodeURIComponent from "decode-uri-component";

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

export function* numberKeys(obj: Record<number, any>): Generator<number> {
	for (const idx of Object.keys(obj)) {
		// https://stackoverflow.com/a/175787/242365
		const number = Number(idx);
		if (!isNaN(number) && !isNaN(parseFloat(idx)))
			yield number;
	}
}

export function getProperty<K, V, T extends Map<K, V>>(obj: T, key: K): V;
export function getProperty<T, K extends keyof T>(obj: T, key: K): T[K]; // eslint-disable-line no-redeclare
export function getProperty(obj: any, key: any): any { // eslint-disable-line no-redeclare
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
			targetObject[i] = cloneDeep(newObject[i]);
	}
}

export function getSafeFilename(fname: string): string {
	return fname.replace(/[\\/:*?"<>|]+/g, '_');
}

export function parsePadUrl(url: string, baseUrl: string): { padId: string; hash: string } | undefined {
	if (url.startsWith(baseUrl)) {
		const m = url.slice(baseUrl.length).match(/^([^/]+)(\/table)?(\?|#|$)/);

		if (m) {
			const hashIdx = url.indexOf("#");
			return {
				padId: decodeURIComponent(m[1]),
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