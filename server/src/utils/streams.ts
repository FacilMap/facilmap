/// <reference path="../deps.d.ts" />

import highland from "highland";
import jsonFormat from "json-format";

export async function asyncIteratorToArray<T>(iterator: AsyncGenerator<T, any, void>): Promise<Array<T>> {
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
