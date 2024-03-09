import { describe, expect, test } from "vitest";
import { arrayToAsyncIterator, asyncIteratorToArray, asyncIteratorToStream, jsonStream, streamPromiseToStream, streamReplace } from "../streams.js";
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
	const template = {
		test1: "%var1%",
		test2: {
			one: "one",
			two: "%var2%",
			three: "three"
		},
		test3: "%var3%",
		test4: "%var4%",
		test5: "%var5%",
		test6: "%var6%",
		test7: "%var7%",
		test8: "bla"
	};

	const stream = jsonStream(template, {
		var1: { test: 'object' },
		var2: arrayToAsyncIterator([ { object: 'one' }, { object: 'two' } ]),
		var3: () => arrayToAsyncIterator([ { object: 'one' }, { object: 'two' } ]),
		var4: 'asdf',
		var5: () => 'bla',
		var6: Promise.resolve('promise'),
		var7: () => Promise.resolve('async')
	});

	const result = (await asyncIteratorToArray(stream as any)).join("");
	expect(result).toBe(
`{
	"test1": {
		"test": "object"
	},
	"test2": {
		"one": "one",
		"two": [
			{
				"object": "one"
			},
			{
				"object": "two"
			}
		],
		"three": "three"
	},
	"test3": [
		{
			"object": "one"
		},
		{
			"object": "two"
		}
	],
	"test4": "asdf",
	"test5": "bla",
	"test6": "promise",
	"test7": "async",
	"test8": "bla"
}`
	);
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

	const result = await asyncIteratorToArray(streamReplace(stream, replaceMap));
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
