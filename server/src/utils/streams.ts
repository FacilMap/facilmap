import { Readable } from "stream";
import { type QueuingStrategy, ReadableStream, TransformStream } from "stream/web";
import Packer from "zip-stream";

export async function asyncIteratorToArray<T>(iterator: AsyncIterable<T>): Promise<Array<T>> {
	const result: T[] = [];
	for await (const it of iterator) {
		result.push(it);
	}
	return result;
}

export async function* arrayToAsyncIterator<T>(array: T[]): AsyncIterable<T> {
	for (const it of array) {
		yield it;
	}
}

export function asyncIteratorToStream<T>(iterator: AsyncIterable<T>, strategy?: QueuingStrategy<T>): ReadableStream<T> {
	const it = iterator[Symbol.asyncIterator]();
	return new ReadableStream<T>({
		async pull(controller) {
			const { value, done } = await it.next();
			if (done) {
				controller.close();
			} else {
				controller.enqueue(value);
			}
		},
	}, strategy);
}

export function mapAsyncIterator<T, O>(iterator: AsyncIterable<T>, mapper: (it: T) => O): AsyncIterable<O> {
	return flatMapAsyncIterator(iterator, (it) => [mapper(it)]);
}

export function filterAsyncIterator<T>(iterator: AsyncIterable<T>, filter: (it: T) => boolean): AsyncIterable<T> {
	return flatMapAsyncIterator(iterator, (it) => filter(it) ? [it] : []);
}

export async function* flatMapAsyncIterator<T, O>(iterator: AsyncIterable<T>, mapper: (it: T) => O[]): AsyncIterable<O> {
	for await (const it of iterator) {
		for (const o of mapper(it)) {
			yield o;
		}
	}
}

export async function* concatAsyncIterators<T>(...iterators: Array<AsyncIterable<T>>): AsyncIterable<T> {
	for (const iterator of iterators) {
		for await (const it of iterator) {
			yield it;
		}
	}
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
	void stream.pipeTo(transform.writable);
	return transform.readable;
}

type Stringifiable = boolean | number | string | undefined | null | Array<Stringifiable> | /* Should be Record<any, Stringifiable> here, but that does not work */ object;
const jsonStreamSymbol = Symbol("jsonStream");
export type JsonStream = ReadableStream<string> & { [jsonStreamSymbol]: true };
const isJsonStream = (obj: unknown): obj is JsonStream => !!obj && typeof obj === "object" && jsonStreamSymbol in obj && !!obj[jsonStreamSymbol];

export function jsonStreamArray(iterator: Iterable<Stringifiable | JsonStream> | AsyncIterable<Stringifiable | JsonStream>): JsonStream {
	return Object.assign(asyncIteratorToStream((async function*() {
		let first = true;
		yield "[";
		for await (const value of iterator) {
			const prefix = `${first ? "" : ","}\n\t`;
			first = false;

			if (isJsonStream(value)) {
				yield prefix;
				for await (const chunk of streamReplace(value, { "\n": `\n\t` })) {
					yield chunk;
				}
			} else {
				yield `${prefix}${JSON.stringify(value, undefined, "\t").replaceAll("\n", "\n\t")}`;
			}
		}
		yield `${first ? "" : "\n"}]`;
	})()), {
		[jsonStreamSymbol]: true as const
	})
}

export function jsonStreamRecord(iterator: Record<string | number, Stringifiable | Promise<Stringifiable> | JsonStream> | AsyncIterable<[key: string | number, value: Stringifiable | Promise<Stringifiable> | JsonStream]>): JsonStream {
	return Object.assign(asyncIteratorToStream((async function*() {
		let first = true;
		yield "{";
		const normalizedIterator = Symbol.asyncIterator in iterator ? iterator : Object.entries(iterator);
		for await (const [key, value] of normalizedIterator) {
			const prefix = `${first ? "" : ","}\n\t${JSON.stringify(key)}: `;
			first = false;

			if (isJsonStream(value)) {
				yield prefix;
				for await (const chunk of streamReplace(value, { "\n": `\n\t` })) {
					yield chunk;
				}
			} else {
				yield `${prefix}${JSON.stringify(await value, undefined, "\t").replaceAll("\n", "\n\t")}`;
			}
		}
		yield `${first ? "" : "\n"}}`;
	})()), {
		[jsonStreamSymbol]: true as const
	})
}

export function stringToStream(string: string): ReadableStream<string> {
	return asyncIteratorToStream((async function*() {
		yield string;
	})());
}

export async function streamToString(stream: ReadableStream<string>): Promise<string> {
	return (await asyncIteratorToArray(stream)).join("");
}

export function streamReplace(stream: ReadableStream<string> | string, replace: Record<string, ReadableStream<string> | string>): ReadableStream<string> {
	const normalizedStream = typeof stream === "string" ? stringToStream(stream) : stream;

	const longestPlaceholder = Math.max(...Object.keys(replace).map((k) => k.length));
	if (longestPlaceholder <= 0) {
		return normalizedStream;
	}

	const replaceCopy = { ...replace };

	return asyncIteratorToStream((async function*() {
		let buffer = "";

		const reader = normalizedStream.getReader();
		while (true) {
			const { value: chunk, done } = await reader.read();
			buffer += chunk ?? "";

			let firstOccurrence;
			while (firstOccurrence = (() => {
				let result: { key: string; idx: number } | undefined;
				for (const key of Object.keys(replace)) {
					const idx = buffer.indexOf(key);
					if (idx !== -1 && (!result || idx < result.idx)) {
						result = { key, idx };
					}
				}
				return result;
			})()) {
				if (firstOccurrence.idx > 0) {
					yield buffer.slice(0, firstOccurrence.idx);
				}
				buffer = buffer.slice(firstOccurrence.idx + firstOccurrence.key.length);

				const replaceValue = replaceCopy[firstOccurrence.key];
				if (typeof replaceValue === "string") {
					yield replaceValue;
				} else {
					const tee = replaceValue.tee();
					replaceCopy[firstOccurrence.key] = tee[0];
					for await (const replaceChunk of tee[1]) {
						yield replaceChunk;
					}
				}
			}

			const minBufferRemain = done ? 0 : 2 * longestPlaceholder - 1;
			if (buffer.length > 0 && buffer.length >= minBufferRemain) {
				if (buffer.length > minBufferRemain) {
					yield buffer.slice(0, buffer.length - minBufferRemain);
				}
				buffer = buffer.slice(buffer.length - minBufferRemain);
			}

			if (done) {
				break;
			}
		}
	})());
}

export type ZipEncodeStreamItem = { filename: string, data: ReadableStream<string> | null };

export function getZipEncodeStream(): TransformStream<ZipEncodeStreamItem, Uint8Array> {
	const archive = new Packer();

	const writable = new WritableStream<ZipEncodeStreamItem>({
		async write(chunk) {
			await new Promise<void>((resolve, reject) => {
				archive.entry(chunk.data && Readable.fromWeb(chunk.data), { name: chunk.filename }, (err: any) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				});
			});
		},

		close() {
			archive.finish();
		}
	});

	return {
		readable: Readable.toWeb(archive),
		writable
	};
}

export function indentStream(stream: ReadableStream<string>, { indent, indentFirst, addNewline }: { indent: string, indentFirst: boolean; addNewline: boolean }): ReadableStream<string> {
	return asyncIteratorToStream((async function*() {
		let first = true;
		for await (const chunk of streamReplace(stream, { "\n": `\n${indent}` })) {
			if (chunk.length > 0) {
				yield `${first && indentFirst ? indent : ""}${chunk}`;
				first = false;
			}
		}
		if (addNewline && !first) {
			yield "\n";
		}
	})());
}