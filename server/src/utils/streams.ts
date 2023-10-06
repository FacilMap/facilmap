import { ReadableStream } from "stream/web";

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
