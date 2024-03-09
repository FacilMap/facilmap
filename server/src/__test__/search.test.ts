import { expect, test } from "vitest";
import { matchLonLat } from "../search";

test("matchLonLat", () => {
	// Simple coordinates
	expect(matchLonLat("1.234,2.345")).toEqual({ lat: 1.234, lon: 2.345 });
	expect(matchLonLat("-1.234,2.345")).toEqual({ lat: -1.234, lon: 2.345 });
	expect(matchLonLat("1.234,-2.345")).toEqual({ lat: 1.234, lon: -2.345 });

	// Integers
	expect(matchLonLat("1,2")).toEqual({ lat: 1, lon: 2 });
	expect(matchLonLat("-1,2")).toEqual({ lat: -1, lon: 2 });
	expect(matchLonLat("1,-2")).toEqual({ lat: 1, lon: -2 });

	// With unicode minus
	expect(matchLonLat("\u22121.234,2.345")).toEqual({ lat: -1.234, lon: 2.345 });
	expect(matchLonLat("1.234,\u22122.345")).toEqual({ lat: 1.234, lon: -2.345 });

	// With spaces
	expect(matchLonLat("  -  1.234  ,  -  2.345  ")).toEqual({ lat: -1.234, lon: -2.345 });

	// With different separators
	expect(matchLonLat("-1.234;-2.345")).toEqual({ lat: -1.234, lon: -2.345 });
	expect(matchLonLat("-1.234 -2.345")).toEqual({ lat: -1.234, lon: -2.345 });

	// Using decimal comma
	expect(matchLonLat("-1,234,-2,345")).toEqual({ lat: -1.234, lon: -2.345 });
	expect(matchLonLat("-1,234;-2,345")).toEqual({ lat: -1.234, lon: -2.345 });
	expect(matchLonLat("-1,234 -2,345")).toEqual({ lat: -1.234, lon: -2.345 });

	// Geo URI
	expect(matchLonLat("geo:-1.234,-2.345")).toEqual({ lat: -1.234, lon: -2.345 });
	expect(matchLonLat("geo:-1.234,-2.345?z=10")).toEqual({ lat: -1.234, lon: -2.345, zoom: 10 });

	// With degree sign
	expect(matchLonLat("-1.234° -2.345°")).toEqual({ lat: -1.234, lon: -2.345 });
	expect(matchLonLat("-1.234 ° -2.345 °")).toEqual({ lat: -1.234, lon: -2.345 });
	expect(matchLonLat("-1.234 °, -2.345 °")).toEqual({ lat: -1.234, lon: -2.345 });

	// With "deg"
	expect(matchLonLat("-1.234deg -2.345deg")).toEqual({ lat: -1.234, lon: -2.345 });
	expect(matchLonLat("-1.234 deg -2.345 deg")).toEqual({ lat: -1.234, lon: -2.345 });
	expect(matchLonLat("-1.234 deg, -2.345 deg")).toEqual({ lat: -1.234, lon: -2.345 });

	// With minutes
	expect(matchLonLat("-1° 24' -2° 36'")).toEqual({ lat: -1.4, lon: -2.6 });
	expect(matchLonLat("-1° 24', -2° 36'")).toEqual({ lat: -1.4, lon: -2.6 });
	expect(matchLonLat("-1 ° 24 ' -2 ° 36 '")).toEqual({ lat: -1.4, lon: -2.6 });

	// With unicode minute sign
	expect(matchLonLat("-1deg 24\u2032 -2deg 36\u2032")).toEqual({ lat: -1.4, lon: -2.6 });
	expect(matchLonLat("-1deg 24\u2032, -2deg 36\u2032")).toEqual({ lat: -1.4, lon: -2.6 });
	expect(matchLonLat("-1 deg 24 \u2032 -2 deg 36 \u2032")).toEqual({ lat: -1.4, lon: -2.6 });

	// With seconds
	expect(matchLonLat("-1° 24' 36\" -2° 36' 72\"")).toEqual({ lat: -1.41, lon: -2.62 });
	expect(matchLonLat("-1° 24' 36\", -2° 36' 72\"")).toEqual({ lat: -1.41, lon: -2.62 });
	expect(matchLonLat("-1 ° 24 ' 36 \" -2 ° 36 ' 72 \"")).toEqual({ lat: -1.41, lon: -2.62 });
	expect(matchLonLat("-1° 36\" -2° 72\"")).toEqual({ lat: -1.01, lon: -2.02 });

	// With unicode second sign
	expect(matchLonLat("-1deg 24\u2032 36\u2033 -2deg 36\u2032 72\u2033")).toEqual({ lat: -1.41, lon: -2.62 });
	expect(matchLonLat("-1deg 24\u2032 36\u2033, -2deg 36\u2032 72\u2033")).toEqual({ lat: -1.41, lon: -2.62 });
	expect(matchLonLat("-1 deg 24 \u2032 36 \u2033 -2 deg 36 \u2032 72 \u2033")).toEqual({ lat: -1.41, lon: -2.62 });
	expect(matchLonLat("-1deg 36\u2033 -2deg 72\u2033")).toEqual({ lat: -1.01, lon: -2.02 });

	// Other hemisphere
	expect(matchLonLat("1° 24' N 2° 36' E")).toEqual({ lat: 1.4, lon: 2.6 });
	expect(matchLonLat("1° 24' S 2° 36' E")).toEqual({ lat: -1.4, lon: 2.6 });
	expect(matchLonLat("1° 24' N 2° 36' W")).toEqual({ lat: 1.4, lon: -2.6 });
	expect(matchLonLat("1° 24' s 2° 36' w")).toEqual({ lat: -1.4, lon: -2.6 });

	// Switch lon/lat
	expect(matchLonLat("1° 24' E 2° 36'")).toEqual({ lat: 2.6, lon: 1.4 });
	expect(matchLonLat("1° 24' E 2° 36' N")).toEqual({ lat: 2.6, lon: 1.4 });
	expect(matchLonLat("1° 24' E 2° 36' S")).toEqual({ lat: -2.6, lon: 1.4 });
	expect(matchLonLat("1° 24' W 2° 36'")).toEqual({ lat: 2.6, lon: -1.4 });
	expect(matchLonLat("1° 24' W 2° 36' N")).toEqual({ lat: 2.6, lon: -1.4 });
	expect(matchLonLat("1° 24' W 2° 36' S")).toEqual({ lat: -2.6, lon: -1.4 });

	// Invalid lon/lat combination
	expect(matchLonLat("1° 24' N 2° 36' N")).toEqual(undefined);
	expect(matchLonLat("1° 24' E 2° 36' E")).toEqual(undefined);
	expect(matchLonLat("1° 24' S 2° 36' S")).toEqual(undefined);
	expect(matchLonLat("1° 24' W 2° 36' W")).toEqual(undefined);
	expect(matchLonLat("1° 24' N 2° 36' S")).toEqual(undefined);
	expect(matchLonLat("1° 24' S 2° 36' N")).toEqual(undefined);
	expect(matchLonLat("1° 24' W 2° 36' E")).toEqual(undefined);
	expect(matchLonLat("1° 24' E 2° 36' W")).toEqual(undefined);
});