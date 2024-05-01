import { describe, expect, test, vi } from "vitest";
import { arrayToAsyncIterator, asyncIteratorToArray, asyncIteratorToStream, decompressStreamIfApplicable, jsonStreamArray, jsonStreamRecord, peekFirstBytes, streamPromiseToStream, streamReplace, streamToString } from "../streams.js";
import { ReadableStream } from "stream/web";

describe("streamPromiseToStream", () => {
	test("retrieves data for resolved promise", async () => {
		const streamPromise = Promise.resolve(new ReadableStream<string>({
			start(controller) {
				controller.enqueue("Test");
				controller.close();
			}
		}));

		const stream = streamPromiseToStream(streamPromise);

		let result = "";
		for await (const chunk of stream) {
			result += chunk;
		}

		expect(result).toEqual("Test");
	});

	test("passes on error from underlying stream", async () => {
		const streamPromise = Promise.resolve(new ReadableStream<string>({
			start(controller) {
				controller.error(new Error("Test"));
			}
		}));

		const stream = streamPromiseToStream(streamPromise);
		const reader = stream.getReader();

		await expect(async () => {
			await reader.read();
		}).rejects.toThrow("Test");
	});

	test("passes on error for rejected promise", async () => {
		const streamPromise = Promise.reject(new Error("Test"));

		const stream = streamPromiseToStream(streamPromise);

		await expect(async () => {
			await stream.getReader().read();
		}).rejects.toThrow("Test");
	});
});

test('jsonStream', async () => {
	const stream = jsonStreamRecord({
		test1: { test: 'object' },
		test2: jsonStreamRecord({
			one: "one",
			two: jsonStreamArray([ { object: 'one' }, { object: 'two' } ]),
			three: "three"
		}),
		test3: jsonStreamRecord(arrayToAsyncIterator(Object.entries({
			one: "one",
			two: jsonStreamArray(arrayToAsyncIterator([ { object: 'one' }, { object: 'two' } ])),
			three: "three"
		}))),
		test4: jsonStreamArray([
			"one",
			jsonStreamRecord({ object1: "one", object2: "two" }),
			"three"
		]),
		test5: jsonStreamArray(arrayToAsyncIterator([
			"one",
			jsonStreamRecord(arrayToAsyncIterator(Object.entries({ object1: "one", object2: "two" }))),
			"three"
		])),
		test6: Promise.resolve("promise"),
		test7: "string"
	});

	const result = (await asyncIteratorToArray(stream as any)).join("");
	expect(result).toBe(JSON.stringify({
		test1: {
			test: "object"
		},
		test2: {
			one: "one",
			two: [{ object: "one" }, { object: "two" }],
			three: "three"
		},
		test3: {
			one: "one",
			two: [{ object: "one" }, { object: "two" }],
			three: "three"
		},
		test4: [
			"one",
			{ object1: "one", object2: "two" },
			"three"
		],
		test5: [
			"one",
			{ object1: "one", object2: "two" },
			"three"
		],
		test6: "promise",
		test7: "string"
	}, undefined, "\t"));
});

test("streamReplace", async () => {
	const replaceMap = {
		"%VAR1%": "var1 replacement",
		"%VAR2%": "var2 replacement",
		"%VAR3%": asyncIteratorToStream((async function* () {
			yield "var2 ";
			yield "replacement";
		})())
	};

	const stream = asyncIteratorToStream((async function* () {
		yield "Before %VA";
		yield "R1% between %V";
		yield "AR2% and %VAR3% after";
	})());

	const result = await asyncIteratorToArray(stream.pipeThrough(streamReplace(replaceMap)));
	expect(result).toEqual([
		"Before ",
		"var1 replacement",
		" between ",
		"var2 replacement",
		" and ",
		"var2 ",
		"replacement",
		" after"
	]);
});

describe("peekFirstBytes", () => {
	test("returns right result", async () => {
		const getResult = vi.fn((chunks: string[]) => {
			const str = chunks.join("");
			if (str.length >= 3) {
				return str;
			}
		});
		const peek = peekFirstBytes(getResult);

		const stream = asyncIteratorToStream(arrayToAsyncIterator(["t", "e", "s", "t"])).pipeThrough(peek);

		expect(await peek.result).toEqual("tes");
		expect(getResult).toBeCalledTimes(3);

		expect(await streamToString(stream)).toEqual("test");
	});

	test("returns undefined if stream ends prematurely", async () => {
		const peek = peekFirstBytes((chunks: string[]) => {
			const str = chunks.join("");
			if (str.length >= 5) {
				return str;
			}
		});

		const stream = asyncIteratorToStream(arrayToAsyncIterator(["t", "e", "s", "t"])).pipeThrough(peek);

		expect(await peek.result).toEqual(undefined);
		expect(await streamToString(stream)).toEqual("test");
	});

	test("rejects on error", async () => {
		const getResult = vi.fn((chunks: string[]) => {
			const str = chunks.join("");
			if (str.length >= 3) {
				return str;
			}
		});
		const peek = peekFirstBytes(getResult);

		const stream = new ReadableStream<string>({
			start: (controller) => {
				controller.error(new Error("test"));
			}
		}).pipeThrough(peek);

		await expect(peek.result).rejects.toThrowError("test");
		await expect(streamToString(stream)).rejects.toThrowError("test");
	});
});

describe("decompressStreamIfApplicable", () => {
	const testData = new TextEncoder().encode("test");

	test("passes through plain text", async () => {
		const stream = asyncIteratorToStream(arrayToAsyncIterator([testData]))
			.pipeThrough(decompressStreamIfApplicable());

		expect(await asyncIteratorToArray(stream)).toEqual([testData]);
	});

	test("decodes bzip2 data", async () => {
		const stream = asyncIteratorToStream(arrayToAsyncIterator([Uint8Array.from(atob("QlpoOTFBWSZTWTOLz6wAAAEBgAIADAAgACGYGYQYXckU4UJAzi8+sA=="), c => c.charCodeAt(0))]))
			.pipeThrough(decompressStreamIfApplicable());

		expect(await asyncIteratorToArray(stream)).toEqual([testData]);
	});

	test("decodes gzip data", async () => {
		const stream = asyncIteratorToStream(arrayToAsyncIterator([Uint8Array.from(atob("H4sIAAAAAAAAAytJLS4BAAx+f9gEAAAA"), c => c.charCodeAt(0))]))
			.pipeThrough(decompressStreamIfApplicable());

		expect(await asyncIteratorToArray(stream)).toEqual([testData]);
	});
});