export type ReactiveObjectProvider = {
	create: <T extends Record<any, any>>(object: T) => T;
	set: <T extends Record<any, any>, K extends keyof T>(object: T, key: K, value: T[K]) => void;
	delete: <T extends Record<any, any>>(object: T, key: keyof { [K in keyof T]: {} extends Pick<T, K> ? K : never }) => void;
}

export const defaultReactiveObjectProvider: ReactiveObjectProvider = {
	create: (object) => object,
	set: (object, key, value) => {
		object[key] = value;
	},
	delete: (object, key) => {
		delete object[key];
	}
};