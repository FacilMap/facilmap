export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export function isPromise(object: any): object is Promise<unknown> {
	return typeof object === 'object' && 'then' in object && typeof object.then === 'function';
}