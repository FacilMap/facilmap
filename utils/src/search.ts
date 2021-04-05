import { Point } from "facilmap-types";

export function splitRouteQuery(query: string): { queries: string[], mode: string | null } {
	const splitQuery = query.split(/(^|\s+)(from|to|via|by)(\s+|$)/).filter((item, i) => (i%2 == 0)); // Filter out every second item (whitespace parantheses)
	const queryParts = {
		from: [] as string[],
		via: [] as string[],
		to: [] as string[],
		by: [] as string[]
	};

	for(let i=0; i<splitQuery.length; i+=2) {
		if(splitQuery[i])
			queryParts[splitQuery[i-1] as keyof typeof queryParts || "from"].push(splitQuery[i]);
	}

	return {
		queries: queryParts.from.concat(queryParts.via, queryParts.to),
		mode: queryParts.by[0] || null
	};
}

type DecodedGeoQuery = Point & { zoom: number };

/**
 * Checks whether the given query string is a representation of coordinates, such an OSM permalink.
 */
export function decodeLonLatUrl(query: string): DecodedGeoQuery | undefined {
	query = query.replace(/^\s+/, "").replace(/\s+$/, "");
	let query_match: RegExpMatchArray | null, query_match2: DecodedGeoQuery | undefined;
	if(query_match = query.match(/^http:\/\/(www\.)?osm\.org\/go\/([-A-Za-z0-9_@]+)/))
	{ // Coordinates, shortlink
		return decodeShortLink(query_match[2]);
	}

	function decodeQueryString(str: string) {
		let lonMatch,latMatch,leafletMatch;

		if((lonMatch = str.match(/[?&]lon=([^&]+)/)) && (latMatch = str.match(/[?&]lat=([^&]+)/))) {
			return {
				lat: Number(decodeURIComponent(latMatch[1])),
				lon: Number(decodeURIComponent(lonMatch[1])),
				zoom: 15
			};
		}

		if(leafletMatch = str.match(/(^|=)(\d+)\/(-?\d+(\.\d+)?)\/(-?\d+(\.\d+)?)(&|\/|$)/)) {
			return {
				lat: Number(leafletMatch[3]),
				lon: Number(leafletMatch[5]),
				zoom: Number(leafletMatch[2])
			};
		}
	}

	if((query_match = query.match(/^https?:\/\/.*#(.*)$/)) && (query_match2 = decodeQueryString(query_match[1]))) {
		return query_match2;
	}

	if((query_match = query.match(/^https?:\/\/.*\?([^#]*)/)) && (query_match2 = decodeQueryString(query_match[1]))) {
		return query_match2;
	}

	return undefined;
}


const shortLinkCharArray = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_@";

/**
 * Decodes a string from FacilMap.Util.encodeShortLink().
*/
export function decodeShortLink(encoded: string): DecodedGeoQuery | undefined {
	const m = encoded.match(/^([A-Za-z0-9_@]+)/);
	if(!m) return undefined;
	const zoom = m[1].length*2+encoded.length-11;

	let c1 = 0;
	let c2 = 0;
	for(let i=0,j=54; i<m[1].length; i++,j-=6)
	{
		const bits = shortLinkCharArray.indexOf(m[1].charAt(i));
		if(j <= 30)
			c1 |= bits >>> (30-j);
		else if(j > 30)
			c1 |= bits << (j-30);
		if(j < 30)
			c2 |= (bits & (0x3fffffff >>> j)) << j;
	}

	let x = 0;
	let y = 0;

	for(let j=29; j>0;)
	{
		x = (x << 1) | ((c1 >> j--) & 1);
		y = (y << 1) | ((c1 >> j--) & 1);
	}
	for(let j=29; j>0;)
	{
		x = (x << 1) | ((c2 >> j--) & 1);
		y = (y << 1) | ((c2 >> j--) & 1);
	}

	x *= 4; // We can’t do <<= 2 here as x and y may be greater than 2³¹ and then the value would become negative
	y *= 4;

	const lon = x*90.0/(1<<30)-180.0;
	const lat = y*45.0/(1<<30)-90.0;

	return {
		lat : Math.round(lat*100000)/100000,
		lon: Math.round(lon*100000)/100000,
		zoom : zoom
	};
}

export function isSearchId(string: string | undefined): boolean {
	return !!string?.match(/^[nwr]\d+$/i);
}