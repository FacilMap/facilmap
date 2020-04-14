import highland from "highland";

export function streamEachPromise<T>(stream: Highland.Stream<T>, handle: (item: T) => Promise<void> | void): Promise<void> {
	return new Promise((resolve, reject) => {
		stream
			.flatMap((item) => highland(Promise.resolve(handle(item as T))))
			.stopOnError(reject)
			.done(resolve);
	});
}

export function streamToArrayPromise<T>(stream: Highland.Stream<T>): Promise<Array<T>> {
	return new Promise((resolve, reject) => {
		stream
			.stopOnError(reject)
			.toArray(resolve)
	})
}
