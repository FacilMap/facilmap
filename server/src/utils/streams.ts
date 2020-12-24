import highland from "highland";
import jsonFormat from "json-format";

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

export function wrapAsync<A extends any[], R>(func: (...args: A) => Promise<R>): (...args: A) => Highland.Stream<R> {
	return (...args: A) => {
		return highland(func(...args));
	};
}

export function toStream<R>(func: () => Promise<R>): Highland.Stream<R> {
	return highland(func());
}

export function jsonStream(template: any, data: Record<string, Highland.Stream<any> | any>): Highland.Stream<string> {
	let lastIndent = '';

	const streams = jsonFormat(template).split(/"%([a-zA-Z0-9-_]+)%"/).map((part, i) => {
		if (i % 2 == 0) {
			const lastLineBreak = part.lastIndexOf('\n');
			if (lastLineBreak != -1)
				lastIndent = part.substr(lastLineBreak + 1).match(/^(\t*)/)![1];

			return highland([ part ]);
		}
		else if (highland.isStream(data[part])) {
			let first = true;
			const indent = lastIndent + "\t";
			return highland([ '[\n' ]).concat(
				data[part].map((obj: any) => {
					const prefix = first ? '' : ',\n';
					first = false;
					return prefix + jsonFormat(obj).replace(/^/gm, indent);
				})
			).concat([ '\n' + lastIndent + ']' ]);
		} else {
			const value = Promise.resolve(typeof data[part] == 'function' ? data[part]() : data[part]);
			const indent = lastIndent;
			return highland(value).map((val) => jsonFormat(val).replace(/\n/g, '\n' + indent));
		}
	});

	return highland(streams).flatten();
}
