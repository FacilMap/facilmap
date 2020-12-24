import { jsonStream } from "../streams";
import highland from "highland";
import jsonFormat from "json-format";

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
		test7: "bla"
	};

	const stream = jsonStream(template, {
		var1: { test: 'object' },
		var2: highland([ { object: 'one' }, { object: 'two' } ]),
		var3: 'asdf',
		var4: () => 'bla',
		var5: Promise.resolve('promise'),
		var6: () => Promise.resolve('async')
	});

	const result = (await stream.collect().toPromise(Promise)).join('');
	expect(result).toBe(jsonFormat({
		test1: { test: 'object' },
		test2: {
			one: "one",
			two: [ { object: 'one' }, { object: 'two' } ],
			three: "three"
		},
		test3: 'asdf',
		test4: "bla",
		test5: "promise",
		test6: "async",
		test7: "bla"
	}));
});