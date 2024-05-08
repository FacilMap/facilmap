import { describe, expect, test, vi } from "vitest";
import { iterableToAsync, iterableToStream, decompressStreamIfApplicable, peekFirstBytes, streamPromiseToStream, streamReplace, streamToString, streamToIterable, streamToArray } from "../streams.js";

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
		for await (const chunk of streamToIterable(stream)) {
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

test("streamReplace", async () => {
	const replaceMap = {
		"%VAR1%": "var1 replacement",
		"%VAR2%": "var2 replacement",
		"%VAR3%": iterableToStream((async function* () {
			yield "var2 ";
			yield "replacement";
		})())
	};

	const stream = iterableToStream((async function* () {
		yield "Before %VA";
		yield "R1% between %V";
		yield "AR2% and %VAR3% after";
	})());

	const result = await streamToArray(stream.pipeThrough(streamReplace(replaceMap)));
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

		const stream = iterableToStream(iterableToAsync(["t", "e", "s", "t"])).pipeThrough(peek);

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

		const stream = iterableToStream(iterableToAsync(["t", "e", "s", "t"])).pipeThrough(peek);

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
		const stream = iterableToStream(iterableToAsync([testData]))
			.pipeThrough(decompressStreamIfApplicable());

		expect(await streamToArray(stream)).toEqual([testData]);
	});

	test("decodes bzip2 data", async () => {
		const stream = iterableToStream(iterableToAsync([Uint8Array.from(atob("QlpoOTFBWSZTWTOLz6wAAAEBgAIADAAgACGYGYQYXckU4UJAzi8+sA=="), c => c.charCodeAt(0))]))
			.pipeThrough(decompressStreamIfApplicable());

		expect(await streamToArray(stream)).toEqual([testData]);
	});

	test("decodes gzip data", async () => {
		const stream = iterableToStream(iterableToAsync([Uint8Array.from(atob("H4sIAAAAAAAAAytJLS4BAAx+f9gEAAAA"), c => c.charCodeAt(0))]))
			.pipeThrough(decompressStreamIfApplicable());

		expect(await streamToArray(stream)).toEqual([testData]);
	});
});