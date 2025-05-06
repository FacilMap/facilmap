import { access } from "node:fs/promises";

const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateRandomId(length: number): string {
	let randomId = "";
	for(let i=0; i<length; i++) {
		randomId += LETTERS[Math.floor(Math.random() * LETTERS.length)];
	}
	return randomId;
}

export function round(number: number, digits: number): number {
	const fac = Math.pow(10, digits);
	return Math.round(number*fac)/fac;
}

export type PromiseMap<T extends object> = {
	[P in keyof T]: PromiseLike<T[P]> | T[P]
}

export async function promiseProps<T extends object>(obj: PromiseMap<T>): Promise<T> {
	const result = { } as T;
	await Promise.all((Object.keys(obj) as Array<keyof T>).map(async (key) => {
		result[key] = (await obj[key]) as any;
	}));
	return result;
}

export async function fileExists(filename: string): Promise<boolean> {
	try {
		await access(filename);
		return true;
	} catch (err: any) {
		if (err.code === 'ENOENT') {
			return false;
		} else {
			throw err;
		}
	}
}

/**
 * Like encodeURIComponent() with a custom escape character instead of %.
 */
export function encodeUrlSafe(data: string, encodeChar: "." | "_" | "-"): string {
	return encodeURIComponent(data)
		.replaceAll(encodeChar, `%${encodeChar.charCodeAt(0).toString(16).padStart(2, "0")}`)
		.replaceAll("%", encodeChar);
}

/**
 * Like decodeURIComponent() with a custom escape character instead of %.
 */
export function decodeUrlSafe(data: string, encodeChar: "." | "_" | "-"): string {
	return decodeURIComponent(data.replaceAll(encodeChar, "%"));
}