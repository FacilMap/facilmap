import { access } from "node:fs/promises";

const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateRandomId(length: number): string {
	let randomPadId = "";
	for(let i=0; i<length; i++) {
		randomPadId += LETTERS[Math.floor(Math.random() * LETTERS.length)];
	}
	return randomPadId;
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


type PromiseCreatorMap<T extends object> = {
	[P in keyof T]: PromiseLike<T[P]> | ((...args: Array<any>) => Promise<T[P]>)
};

export function promiseAuto<T extends Record<string, any>>(obj: PromiseCreatorMap<T>): Promise<T> {
	const promises = { } as PromiseMap<T>;

	function _get(str: keyof T & string) {
		const dep = obj[str];
		if(!dep)
			throw new Error("Invalid dependency '" + String(str) + "' in promiseAuto().");

		if(promises[str])
			return promises[str];

		if(dep instanceof Function) {
			const params = getFuncParams(dep) as Array<keyof T>;
			return promises[str] = _getDeps(params).then(function(res) {
				return (dep as any)(...params.map((param) => res[param]));
			});
		} else {
			return Promise.resolve(dep as any);
		}
	}

	function _getDeps(arr: Array<keyof T>) {
		const deps = { } as PromiseMap<T>;
		arr.forEach(function(it) {
			deps[it] = _get(it as string);
		});
		return promiseProps(deps);
	}

	return _getDeps(Object.keys(obj) as Array<keyof T>);
}

function getFuncParams(func: Function) {
	// Taken from angular injector code

	const ARROW_ARG = /^([^(]+?)\s*=>/;
	const FN_ARGS = /^[^(]*\(\s*([^)]*)\)/m;
	const FN_ARG_SPLIT = /\s*,\s*/;
	const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

	const fnText = (Function.prototype.toString.call(func) + ' ').replace(STRIP_COMMENTS, '');
	const match = (fnText.match(ARROW_ARG) || fnText.match(FN_ARGS));
	if (!match) {
		throw new Error("Could not parse function params.");
	}
	const params = match[1];
	return params == "" ? [ ] : params.split(FN_ARG_SPLIT);
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
