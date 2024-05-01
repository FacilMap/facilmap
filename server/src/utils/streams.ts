import { Readable, Transform, Writable } from "stream";
import { type QueuingStrategy, ReadableStream, TransformStream } from "stream/web";
import Packer from "zip-stream";
import bz2 from "unbzip2-stream";
import zlib from "zlib";

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

export function mapAsyncIterator<T, O>(iterator: AsyncIterable<T>, mapper: (it: T) => (O | Promise<O>)): AsyncIterable<O> {
	return flatMapAsyncIterator(iterator, async (it) => [await mapper(it)]);
}

export function filterAsyncIterator<T>(iterator: AsyncIterable<T>, filter: (it: T) => (boolean | Promise<boolean>)): AsyncIterable<T> {
	return flatMapAsyncIterator(iterator, async (it) => (await filter(it)) ? [it] : []);
}

export async function* flatMapAsyncIterator<T, O>(iterator: AsyncIterable<T>, mapper: (it: T) => (O[] | Promise<O[]>)): AsyncIterable<O> {
	for await (const it of iterator) {
		for (const o of await mapper(it)) {
			yield o;
		}
	}
}

export async function* concatAsyncIterators<T>(...iterators: Array<AsyncIterable<T> | (() => AsyncIterable<T>)>): AsyncIterable<T> {
	for (const iterator of iterators) {
		for await (const it of typeof iterator === "function" ? iterator() : iterator) {
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
				for await (const chunk of value.pipeThrough(streamReplace({ "\n": `\n\t` }))) {
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
				for await (const chunk of value.pipeThrough(streamReplace({ "\n": `\n\t` }))) {
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

/**
 * A TransformStream that rearranges its chunks in a way that if any of the specified lookup values occur in the
 * input data, they are rechunked so that the lookup value is always emitted as a separate chunk. This allows
 * implementing custom behaviour on the occurrence of a specific value, such as replacing the value with something
 * else.
 */
export class LookupTransformStream extends TransformStream<string, string> {
	constructor(
		transformer: Transformer<string, string> & { lookupValues: string[] },
		writableStrategy?: QueuingStrategy<string>,
		readableStrategy?: QueuingStrategy<string>
	) {
		const { transform, flush, lookupValues, ...rest } = transformer;

		const longestPlaceholder = Math.max(...lookupValues.map((k) => k.length));
		if (longestPlaceholder <= 0) {
			super({ transform, ...rest }, writableStrategy, readableStrategy);
			return;
		}

		let buffer = "";

		super({
			...rest,
			transform: async (chunk, controller) => {
				buffer += chunk ?? "";

				let firstOccurrence;
				while (firstOccurrence = (() => {
					let result: { key: string; idx: number } | undefined;
					for (const key of lookupValues) {
						const idx = buffer.indexOf(key);
						if (idx !== -1 && (!result || idx < result.idx)) {
							result = { key, idx };
						}
					}
					return result;
				})()) {
					if (firstOccurrence.idx > 0) {
						await transform?.(buffer.slice(0, firstOccurrence.idx), controller);
					}
					buffer = buffer.slice(firstOccurrence.idx + firstOccurrence.key.length);

					await transform?.(firstOccurrence.key, controller);
				}

				const minBufferRemain = 2 * longestPlaceholder - 1;
				if (buffer.length > 0 && buffer.length >= minBufferRemain) {
					if (buffer.length > minBufferRemain) {
						await transform?.(buffer.slice(0, buffer.length - minBufferRemain), controller);
					}
					buffer = buffer.slice(buffer.length - minBufferRemain);
				}
			},

			flush: async (controller) => {
				await transform?.(buffer, controller);
				await flush?.(controller);
			}
		}, writableStrategy, readableStrategy);
	}
}

/**
 * Returns a TransformStream that replaces each of the occurrences of the keys in the specified replace map with its corresponding value.
 */
export function streamReplace(replace: Record<string, ReadableStream<string> | string>): TransformStream<string> {
	const replaceCopy = Object.assign(Object.create(null), replace);
	return new LookupTransformStream({
		lookupValues: Object.keys(replace),
		transform: async (value, controller) => {
			if (value in replaceCopy) {
				const replaceValue = replaceCopy[value];
				if (typeof replaceValue === "string") {
					controller.enqueue(replaceValue);
				} else {
					const tee = replaceValue.tee();
					replaceCopy[value] = tee[0];
					for await (const replaceChunk of tee[1]) {
						controller.enqueue(replaceChunk);
					}
				}
			} else {
				controller.enqueue(value);
			}
		}
	});
}

/**
 * A TransformStream that is set up by providing a ReadableStream mapper rather than transforming individual chunks using
 * start(), transform() and flush().
 * This allows access to ReadableStream methods such as pipeThrough(), which makes it easy to reuse other TransformStreams
 * in the implementation.
 * @param transformReadable Retrieves one parameter with a ReadableStream that emits the input data of the TransformStream.
 *     Should return a ReadableStream whose output will become the output data of the TransformStream.
 */
// https://stackoverflow.com/a/78404600/242365
export class PipeableTransformStream<I, O> extends TransformStream<I, O> {
	constructor(transformReadable: (readable: ReadableStream<I>) => ReadableStream<O>, writableStrategy?: QueuingStrategy<I>, readableStrategy?: QueuingStrategy<O>) {
		super({}, writableStrategy);
		const readable = transformReadable(super.readable as any).pipeThrough(new TransformStream({}, undefined, readableStrategy));
		Object.defineProperty(this, "readable", {
			get() {
				return readable;
			}
		});
	}
}

export type ZipEncodeStreamItem = { filename: string, data: ReadableStream<string> | null };

export function getZipEncodeStream(): TransformStream<ZipEncodeStreamItem, Uint8Array> {
	return new PipeableTransformStream<ZipEncodeStreamItem, Uint8Array>((readable) => {
		const archive = new Packer();

		void readable.pipeTo(new WritableStream<ZipEncodeStreamItem>({
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
		}));

		return Readable.toWeb(archive) as ReadableStream<Uint8Array>;
	});
}

export function indentStream({ indent, indentFirst, addNewline }: { indent: string, indentFirst: boolean; addNewline: boolean }): TransformStream<string> {
	let first = true;
	return new PipeableTransformStream((readable) => readable
		.pipeThrough(streamReplace({ "\n": `\n${indent}` }))
		.pipeThrough(new TransformStream({
			transform: (chunk, controller) => {
				if (chunk.length > 0) {
					controller.enqueue(`${first && indentFirst ? indent : ""}${chunk}`);
					first = false;
				}
			},
			flush: (controller) => {
				if (addNewline && !first) {
					controller.enqueue("\n");
				}
			}
		})
	));
}

export type StreamWithResult<S extends {}, R> = S & { result: Promise<R> };

export function streamWithResult<S extends {}, R>(
	createStream: (resolve: (result: R) => void, reject: (err: Error) => void) => S
): StreamWithResult<S, R> {
	let resolve: (v: R) => void, reject: (err: any) => void;
	const result = new Promise<R>((res, rej) => {
		[resolve, reject] = [res, rej];
	});
	const transform = createStream(resolve!, reject!);
	return Object.assign(transform, {
		result
	});
}

/**
 * Allows to peek at the beginning of a stream (for example to look at its magic number) without losing the chunks looked at.
 * Returns a transform stream that reads the input data and continuously calls the specified getResult() function on it.
 * Once getResult() returns a value (other than undefined), the returned "result" promise is resolved with that value and the function
 * is not called anymore.
 * Back pressure is handled in a way that the stream keeps consuming the input data until getResult() returns a value. After that,
 * pressure will be handled by the consumption of the output stream.
 * @param getResult A callback that receives an array of all chunks retrieved so far and should return the desired result or undefined
 *     to keep it being called with more chunks.
 * @returns A transform stream that passes through all data unmodified. The object has an additional "result" property that is a promise
 *     that is either resolved with the result returned by getResult(), or resolved with undefined (if the stream ended before getResult()
 *     returned a value), or rejected (if the stream threw an error).
 */
export function peekFirstBytes<T, R>(
	getResult: (chunks: T[]) => R | undefined
): TransformStream<T, T> & { result: Promise<R | undefined> } {
	return streamWithResult((resolve, reject) => new PipeableTransformStream<T, T>((readable) => {
		const [copy, peek] = readable.tee();
		const reader = peek.getReader();

		(async () => {
			const chunks: T[] = [];
			while (true) { // eslint-disable-line no-constant-condition
				const { done, value } = await reader.read();
				if (done) {
					break;
				} else {
					chunks.push(value);

					const result = getResult(chunks);
					if (result) {
						return result;
					}
				}
			}
		})().then((result) => {
			void reader.cancel();
			resolve(result);
		}).catch(reject);

		return copy;
	}));
}

export function concatArrayBuffers(chunks: Uint8Array[]): Uint8Array {
    const result = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}

/**
 * Peeks into the first bytes of the input stream, and if they contain the magic numbers of GZIP/Bzip2, outputs
 * the decompressed data. If they don't contain the magic numbers, outputs the input stream unmodified.
 */
export function decompressStreamIfApplicable(): TransformStream<Uint8Array, Uint8Array> {
	return new PipeableTransformStream((readable) => streamPromiseToStream((async () => {
		const peek = peekFirstBytes((chunks: Uint8Array[]) => {
			const buf = concatArrayBuffers(chunks);
			if (buf.length >= 3) {
				if(buf[0] == 0x42 && buf[1] == 0x5a && buf[2] == 0x68) { // bzip2
					return "bzip2";
				} else if(buf[0] == 0x1f && buf[1] == 0x8b && buf[2] == 0x08) { // gzip
					return "gzip";
				} else {
					return "";
				}
			}
		});

		const readable2 = readable.pipeThrough(peek);
		const result = await peek.result;
		if (result === "bzip2") {
			const bzip2 = Object.assign(bz2(), {
				// bz2 uses through, which returns something that matches the public interface of a NodeJS Transform stream,
				// but is a custom implementation of a NodeJS Stream under the hood. Because of this, we cannot use
				// Transform.toWeb() on it. But Writable.toWeb() seems to work out of the box and adding this property
				// seems to be enough to trick Readable.toWeb() into thinking that this is a proper Readable stream.
				_readableState: {}
			});
			return readable2.pipeThrough({
				readable: Readable.toWeb(bzip2),
				writable: Writable.toWeb(bzip2)
			});
		} else if (result === "gzip") {
			return readable2.pipeThrough(Transform.toWeb(zlib.createGunzip()));
		} else {
			return readable2;
		}
	})()));
}