const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const LENGTH = 12;

export function quoteJavaScript(str: any): string {
	return "'" + `${str}`.replace(/['\\]/g, '\\$1').replace(/\n/g, "\\n") + "'";
}

export function quoteHtml(str: any): string {
	return `${str}`.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export function quoteRegExp(str: string): string {
	return `${str}`.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
}

export function generateRandomPadId(length: number = LENGTH): string {
	let randomPadId = "";
	for(let i=0; i<length; i++) {
		randomPadId += LETTERS[Math.floor(Math.random() * LETTERS.length)];
	}
	return randomPadId;
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
		const pair = segment.split("=");
		obj[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
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

export function normalizeMarkerName(name: string | undefined): string {
	return name || "Untitled marker";
}

export function normalizeLineName(name: string | undefined): string {
	return name || "Untitled line";
}
