import { ReadableStream, TransformStream } from "stream/web";

export async function asyncIteratorToArray<T>(iterator: AsyncIterable<T>): Promise<Array<T>> {
	const result: T[] = [];
	for await (const it of iterator) {
		result.push(it);
	}
	return result;
}

export async function* arrayToAsyncIterator<T>(array: T[]): AsyncGenerator<T, void, void> {
	for (const it of array) {
		yield it;
	}
}

export function asyncIteratorToStream<T>(iterator: AsyncGenerator<T, void, void>): ReadableStream<T> {
	return new ReadableStream<T>({
		async pull(controller) {
			const { value, done } = await iterator.next();
			if (done) {
				controller.close();
			} else {
				controller.enqueue(value);
			}
		},
	});
}

export function streamPromiseToStream<T>(streamPromise: Promise<ReadableStream<T>>): ReadableStream<T> {
	const transform = new TransformStream({
		async start() {
			const stream = await streamPromise;
			stream.pipeTo(transform.writable).catch(() => {}); // Catch error to avoid unhandled rejection, see https://github.com/nodejs/node/issues/50707
		}
	});
	return transform.readable;
}

export function mapStream<T, O>(stream: ReadableStream<T>, mapper: (it: T) => O): ReadableStream<O> {
	return flatMapStream(stream, (it) => [mapper(it)]);
}

export function filterStream<T>(stream: ReadableStream<T>, filter: (it: T) => boolean): ReadableStream<T> {
	return flatMapStream(stream, (it) => filter(it) ? [it] : []);
}

export function flatMapStream<T, O>(stream: ReadableStream<T>, mapper: (it: T) => O[]): ReadableStream<O> {
	const transform = new TransformStream<T>({
		async transform(chunk, controller) {
			for (const result of mapper(chunk)) {
				controller.enqueue(result);
			}
		}
	});
	stream.pipeTo(transform.writable);
	return transform.readable;
}

export function jsonStream(template: any, data: Record<string, AsyncGenerator<any, any, void> | Promise<any> | any | (() => AsyncGenerator<any, any, void> | Promise<any> | any)>): ReadableStream<string> {
	return asyncIteratorToStream((async function*() {
		let lastIndent = '';

		const parts = JSON.stringify(template, undefined, "\t").split(/"%([a-zA-Z0-9-_]+)%"/);
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];

			if (i % 2 == 0) {
				const lastLineBreak = part.lastIndexOf('\n');
				if (lastLineBreak != -1)
					lastIndent = part.slice(lastLineBreak + 1).match(/^(\t*)/)![1];

				yield part;
			} else {
				const value = await (typeof data[part] === 'function' ? data[part]() : data[part]);

				if (typeof value === 'object' && value && Symbol.asyncIterator in value) {
					let first = true;
					const indent = lastIndent + "\t";
					yield '[\n';
					for await (const obj of value) {
						const prefix = first ? '' : ',\n';
						first = false;
						yield prefix + JSON.stringify(obj, undefined, "\t").replace(/^/gm, indent);
					}
					yield '\n' + lastIndent + ']';
				} else {
					const indent = lastIndent;
					yield JSON.stringify(value, undefined, "\t").replace(/\n/g, '\n' + indent);
				}
			}
		}
	})());
}
