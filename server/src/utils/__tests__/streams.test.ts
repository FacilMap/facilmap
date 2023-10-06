import { arrayToAsyncIterator, asyncIteratorToArray, jsonStream } from "../streams.js";

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