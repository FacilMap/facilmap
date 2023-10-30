import { expect, test } from "vitest";
import { decodeLegacyHash, decodeQueryString } from "../legacyHash";

test('decodeQueryString', () => {
	expect(decodeQueryString(
		"test=val+1"
		+ "&test%202=val%202"
		+ "&test3.test+1.bla=val+3"
		+ ";test4[test+1][bla]=val+4"
		+ "&test5[test][]=val5&test5[test][]=val6"
		+ "&test6[][test]=val7&test6[][test]=val8"
	))
		.toEqual({
			test: "val 1",
			"test 2": "val 2",
			test3: { "test 1": { bla: "val 3" }},
			test4: { "test 1": { bla: "val 4" }},
			test5: { test: { 0: "val5", 1: "val6" }},
			test6: { 0: { test: "val7" }, 1: { test: "val8"}}
		});
});

test('decodeLegacyHash', () => {
	expect(decodeLegacyHash('lon=11.7268775;lat=53.04781777;zoom=9;layer=MSfR;c.s.type=fastest;c.s.medium=car;q.0=Berlin;q.1=Hamburg;q.2=Bremen'))
		.toEqual([ '9', '53.04781777', '11.7268775', 'MSfR', 'Berlin to Hamburg to Bremen by car' ]);

	expect(decodeLegacyHash('lon=13.4385964;lat=52.5198535;zoom=11;layer=MSfR;q=Berlin'))
		.toEqual([ '11', '52.5198535', '13.4385964', 'MSfR', 'Berlin' ]);

	expect(decodeLegacyHash('lon=13.4385964;lat=52.5198535;zoom=11;layer=MSfR;l.OPTM.visibility=1;q=Berlin'))
		.toEqual([ '11', '52.5198535', '13.4385964', 'MSfR-OPTM', 'Berlin' ]);
});