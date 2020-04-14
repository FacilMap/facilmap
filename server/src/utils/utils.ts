const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateRandomId(length: number) {
	let randomPadId = "";
	for(let i=0; i<length; i++) {
		randomPadId += LETTERS[Math.floor(Math.random() * LETTERS.length)];
	}
	return randomPadId;
}

const FAILURE = Symbol('failure');

export function stripObject(obj: object, structure: object): boolean {
	return _stripObject(obj, structure) !== FAILURE;
}

function _stripObject(obj: any, type: any): any {
	if(obj === undefined)
		return obj;
	else if(obj === null)
		return obj;
	else if(type instanceof Array) {
		if(!(obj instanceof Array))
			return FAILURE;

		for(let i=0; i<obj.length; i++) {
			if((obj[i] = _stripObject(obj[i], type[0])) === FAILURE)
				return FAILURE;
		}
		return obj;
	}
	else if(typeof type == "function")
		return (obj instanceof type) ? obj : FAILURE;
	else if(type instanceof Object) {
		if(!(obj instanceof Object))
			return FAILURE;

		for(const i in obj) {
			if(type[i] == null || obj[i] === undefined)
				delete obj[i];
			else if((obj[i] = _stripObject(obj[i], type[i])) === FAILURE)
				return FAILURE;
		}
		return obj;
	}
	else if(type == "number" && typeof obj == "string")
		return obj == "" ? null : isNaN(obj = Number(obj)) ? FAILURE : obj;
	else if(type == "string" && typeof obj == "number")
		return ""+obj;
	else if(typeof type == "string")
		return (typeof obj == type) ? obj : FAILURE;
	else
		return FAILURE;
}

export function round(number: number, digits: number) {
	const fac = Math.pow(10, digits);
	return Math.round(number*fac)/fac;
}

/* type PromisePropsResult<T extends Record<any, PromiseLike<any>>> = {
	[P in keyof T]: Parameters<T[P].then>
}; */

type PromiseMap<T extends object> = {
	[P in keyof T]: PromiseLike<T[P]>
}

export async function promiseProps<T extends object>(obj: PromiseMap<T>): Promise<T> {
	const result = { } as T;
	await Promise.all((Object.keys(obj) as Array<keyof T>).map(async (key) => {
		result[key] = await obj[key];
	}));
	return result;
}

type PromiseCreatorMap<T extends object> = {
	[P in keyof T]: PromiseLike<T[P]> | ((...args: Array<any>) => Promise<T[P]>)
};

export function promiseAuto<T extends object>(obj: PromiseCreatorMap<T>): Promise<T> {
	const promises = { } as PromiseMap<T>;

	function _get(str: keyof T) {
		const dep = obj[str];
		if(!dep)
			throw new Error("Invalid dependency '" + str + "' in promiseAuto().");

		if(promises[str])
			return promises[str];

		if(dep instanceof Function) {
			const params = getFuncParams(dep) as Array<keyof T>;
			return promises[str] = _getDeps(params).then(function(res) {
				return dep.apply(null, params.map(function(param) { return res[param]; }));
			});
		} else {
			return Promise.resolve(dep as any);
		}
	}

	function _getDeps(arr: Array<keyof T>) {
		const deps = { } as PromiseMap<T>;
		arr.forEach(function(it) {
			deps[it] = _get(it);
		});
		return promiseProps(deps);
	}

	return _getDeps(Object.keys(obj) as Array<keyof T>);
}

function getFuncParams(func: Function) {
	// Taken from angular injector code

	const ARROW_ARG = /^([^\(]+?)\s*=>/;
	const FN_ARGS = /^[^\(]*\(\s*([^\)]*)\)/m;
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

export function clone<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}
