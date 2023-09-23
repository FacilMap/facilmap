import { round } from "./utils/utils.js";
import cheerio from "cheerio";
import compressjs from "compressjs";
import zlib from "zlib";
import util from "util";
import { getElevationForPoint, getElevationForPoints } from "./elevation.js";
import { ZoomLevel, Point, SearchResult } from "facilmap-types";
import { Geometry } from "geojson";
import stripBomBuf from "strip-bom-buf";
import fetch from "node-fetch";
import throttle from "p-throttle";
import config from "./config.js";

interface NominatimResult {
	place_id: number;
	license: string;
	osm_type: "node" | "way" | "relation";
	osm_id: number;
	boundingbox: [string, string, string, string];
	lat: string;
	lon: string;
	zoom?: number;
	name: string;
	display_name: string;
	place_rank: number;
	category: string;
	type: string;
	importance: number;
	icon: string;
	address: Partial<Record<string, string>>;
	geojson: Geometry;
	extratags: Record<string, string>;
	namedetails: Record<string, string> | null;
	elevation?: number; // Added by us
}

interface NominatimError {
	error: { code?: number; message: string } | string;
}

const nameFinderUrl = "https://nominatim.openstreetmap.org";
const limit = 25;
const stateAbbr: Record<string, Record<string, string>> = {
	"us" : {
		"alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA","colorado":"CO","connecticut":"CT",
		"delaware":"DE","florida":"FL","georgia":"GA","hawaii":"HI","idaho":"ID","illinois":"IL","indiana":"IN","iowa":"IA",
		"kansas":"KS","kentucky":"KY","louisiana":"LA","maine":"ME","maryland":"MD","massachusetts":"MA","michigan":"MI",
		"minnesota":"MN","mississippi":"MS","missouri":"MO","montana":"MT","nebraska":"NE","nevada":"NV","new hampshire":"NH",
		"new jersey":"NJ","new mexico":"NM","new york":"NY","north carolina":"NC","north dakota":"ND","ohio":"OH","oklahoma":"OK",
		"oregon":"OR","pennsylvania":"PA","rhode island":"RI","south carolina":"SC","south dakota":"SD","tennessee":"TN",
		"texas":"TX","utah":"UT","vermont":"VT","virginia":"VA","washington":"WA","west virginia":"WV","wisconsin":"WI","wyoming":"WY"
	},
	"it" : {
		"agrigento":"AG","alessandria":"AL","ancona":"AN","aosta":"AO","arezzo":"AR","ascoli piceno":"AP","asti":"AT",
		"avellino":"AV","bari":"BA","barletta":"BT","barletta-andria-trani":"BT","belluno":"BL","benevento":"BN",
		"bergamo":"BG","biella":"BI","bologna":"BO","bolzano":"BZ","brescia":"BS","brindisi":"BR","cagliari":"CA",
		"caltanissetta":"CL","campobasso":"CB","carbonia-iglesias":"CI","caserta":"CE","catania":"CT","catanzaro":"CZ",
		"chieti":"CH","como":"CO","cosenza":"CS","cremona":"CR","crotone":"KR","cuneo":"CN","enna":"EN","fermo":"FM",
		"ferrara":"FE","firenze":"FI","foggia":"FG","forli-cesena":"FC","frosinone":"FR","genova":"GE","gorizia":"GO",
		"grosseto":"GR","imperia":"IM","isernia":"IS","la spezia":"SP","l'aquila":"AQ","latina":"LT","lecce":"LE",
		"lecco":"LC","livorno":"LI","lodi":"LO","lucca":"LU","macerata":"MC","mantova":"MN","massa e carrara":"MS",
		"matera":"MT","medio campidano":"VS","messina":"ME","milano":"MI","modena":"MO","monza e brianza":"MB",
		"napoli":"NA","novara":"NO","nuoro":"NU","ogliastra":"OG","olbia-tempio":"OT","oristano":"OR","padova":"PD",
		"palermo":"PA","parma":"PR","pavia":"PV","perugia":"PG","pesaro e urbino":"PU","pescara":"PE","piacenza":"PC",
		"pisa":"PI","pistoia":"PT","pordenone":"PN","potenza":"PZ","prato":"PO","ragusa":"RG","ravenna":"RA",
		"reggio calabria":"RC","reggio emilia":"RE","rieti":"RI","rimini":"RN","roma":"RM","rovigo":"RO","salerno":"SA",
		"sassari":"SS","savona":"SV","siena":"SI","siracusa":"SR","sondrio":"SO","taranto":"TA","teramo":"TE","terni":"TR",
		"torino":"TO","trapani":"TP","trento":"TN","treviso":"TV","trieste":"TS","udine":"UD","varese":"VA","venezia":"VE",
		"verbano":"VB","verbano-cusio-ossola":"VB","vercelli":"VC","verona":"VR","vibo valentia":"VV","vicenza":"VI","viterbo":"VT"
	},
	"ca" : {
		"ontario":"ON","quebec":"QC","nova scotia":"NS","new brunswick":"NB","manitoba":"MB","british columbia":"BC",
		"prince edward island":"PE","saskatchewan":"SK","alberta":"AB","newfoundland and labrador":"NL"
	},
	"au" : {
		"australian capital territory":"ACT","jervis bay territory":"JBT","new south wales":"NSW","northern territory":"NT",
		"queensland":"QLD","south australia":"SA","tasmania":"TAS","victoria":"VIC","western australia":"WA"
	}
};

// Respect Nominatim rate limit (https://operations.osmfoundation.org/policies/nominatim/)
const throttledFetch = throttle({ limit: 1, interval: 1000 })(fetch);

interface PointWithZoom extends Point {
	zoom?: ZoomLevel;
}

export async function find(query: string, loadUrls = false, loadElevation = false): Promise<Array<SearchResult> | string> {
	query = query.replace(/^\s+/, "").replace(/\s+$/, "");

	if(loadUrls) {
		let m = query.match(/^(node|way|relation)\s+(\d+)$/);
		if(m)
			return await _loadUrl("https://api.openstreetmap.org/api/0.6/" + m[1] + "/" + m[2] + (m[1] != "node" ? "/full" : ""), true);

		m = query.match(/^trace\s+(\d+)$/);
		if(m)
			return await _loadUrl("https://www.openstreetmap.org/trace/" + m[1] + "/data");

		if(query.match(/^https?:\/\//))
			return await _loadUrl(query);
	}

	const lonlat_match = query.match(/^(geo\s*:\s*)?(-?\s*\d+([.,]\d+)?)\s*[,;]\s*(-?\s*\d+([.,]\d+)?)(\s*\?z\s*=\s*(\d+))?$/);
	if(lonlat_match) {
		const result = await _findLonLat({
			lat: Number(lonlat_match[2].replace(",", ".").replace(/\s+/, "")),
			lon : Number(lonlat_match[4].replace(",", ".").replace(/\s+/, "")),
			zoom : lonlat_match[7] != null ? Number(lonlat_match[7]) : undefined
		}, loadElevation);
		return result.map((res) => ({ ...res, id: query }));
	}

	const osm_match = query.match(/^([nwr])(\d+)$/i);
	if(osm_match)
		return await _findOsmObject(osm_match[1], osm_match[2], loadElevation);

	return await _findQuery(query, loadElevation);
}

async function _findQuery(query: string, loadElevation = false): Promise<Array<SearchResult>> {
	const body: Array<NominatimResult> | NominatimError = await throttledFetch(
		nameFinderUrl + "/search?format=jsonv2&polygon_geojson=1&addressdetails=1&namedetails=1&limit=" + encodeURIComponent(limit) + "&extratags=1&q=" + encodeURIComponent(query),
		{
			headers: {
				"User-Agent": config.userAgent
			}
		}
	).then((res) => res.json() as any);

	if(!body)
		throw new Error("Invalid response from name finder.");

	if('error' in body)
		throw new Error(typeof body.error === 'string' ? body.error : body.error.message);

	const points = body.filter((res) => (res.lon && res.lat));
	if(loadElevation && points.length > 0) {
		const elevations = await getElevationForPoints(points);
		elevations.forEach((elevation, i) => {
			points[i].elevation = elevation;
		});
	}

	return body.map(_prepareSearchResult);
}

async function _findOsmObject(type: string, id: string, loadElevation = false): Promise<Array<SearchResult>> {
	const body: Array<NominatimResult> | NominatimError = await throttledFetch(
		`${nameFinderUrl}/lookup?format=jsonv2&addressdetails=1&polygon_geojson=1&extratags=1&namedetails=1&osm_ids=${encodeURI(type.toUpperCase())}${encodeURI(id)}`,
		{
			headers: {
				"User-Agent": config.userAgent
			}
		}
	).then((res) => res.json() as any);

	if(!body)
		throw new Error("Invalid response from name finder.");

	if('error' in body)
		throw new Error(typeof body.error === 'string' ? body.error : body.error.message);

	const points = body.filter((res) => (res.lon && res.lat));
	if(loadElevation && points.length > 0) {
		const elevations = await getElevationForPoints(points);
		elevations.forEach((elevation, i) => {
			points[i].elevation = elevation;
		});
	}

	return body.map(_prepareSearchResult);
}

async function _findLonLat(lonlatWithZoom: PointWithZoom, loadElevation = false): Promise<Array<SearchResult>> {
	const [body, elevation] = await Promise.all([
		throttledFetch(
			`${nameFinderUrl}/reverse?format=jsonv2&addressdetails=1&polygon_geojson=0&extratags=1&namedetails=1&lat=${encodeURIComponent(lonlatWithZoom.lat)}&lon=${encodeURIComponent(lonlatWithZoom.lon)}&zoom=${encodeURIComponent(lonlatWithZoom.zoom != null ? (lonlatWithZoom.zoom >= 12 ? lonlatWithZoom.zoom+2 : lonlatWithZoom.zoom) : 17)}`,
			{
				headers: {
					"User-Agent": config.userAgent
				}
			}
		).then((res) => res.json() as any),
		...(loadElevation ? [getElevationForPoint(lonlatWithZoom)] : [])
	]);

	if(!body || body.error) {
		const name = round(lonlatWithZoom.lat, 5) + ", " + round(lonlatWithZoom.lon, 5);
		return [ {
			lat: lonlatWithZoom.lat,
			lon : lonlatWithZoom.lon,
			type : "coordinates",
			short_name: name,
			display_name : name,
			zoom: lonlatWithZoom.zoom != null ? lonlatWithZoom.zoom : 15,
			icon: undefined,
			elevation: elevation
		} ];
	}

	body.lat = lonlatWithZoom.lat;
	body.lon = lonlatWithZoom.lon;
	body.zoom = lonlatWithZoom.zoom || 15;

	body.elevation = elevation;

	return [ _prepareSearchResult(body) ];
}

function _prepareSearchResult(result: NominatimResult): SearchResult {
	const { address, nameWithAddress, name } = _formatAddress(result);
	return {
		short_name: name,
		display_name: nameWithAddress,
		address,
		boundingbox: result.boundingbox?.map((n) => Number(n)) as [number, number, number, number],
		lat: Number(result.lat),
		lon: Number(result.lon),
		zoom: result.zoom,
		extratags: result.extratags,
		geojson: result.geojson,
		icon: result.icon && result.icon.replace(/^.*\/([a-z0-9_]+)\.[a-z0-9]+\.[0-9]+\.[a-z0-9]+$/i, "$1"),
		type: result.type == "yes" ? result.category : result.type,
		id: result.osm_id ? result.osm_type.charAt(0) + result.osm_id : undefined,
		elevation: result.elevation
	};
}

/**
 * Tries to format a search result in a readable way according to the address notation habits in
 * the appropriate country.
 * @param result {Object} A place object as returned by Nominatim
 * @return {Object} An object with address, nameWithAddress and name strings
 */
function _formatAddress(result: NominatimResult) {
	// See http://en.wikipedia.org/wiki/Address_%28geography%29#Mailing_address_format_by_country for
	// address notation guidelines

	let type = result.type;
	let name = result.namedetails?.name ?? result.name;
	const countryCode = result.address.country_code;

	let road = result.address.road;
	const housenumber = result.address.house_number;
	let suburb = result.address.town || result.address.suburb || result.address.village || result.address.hamlet || result.address.residential;
	const postcode = result.address.postcode;
	let city = result.address.city;
	let county = result.address.county;
	let state = result.address.state;
	const country = result.address.country;

	if([ "road", "residential", "town", "suburb", "village", "hamlet", "residential", "city", "county", "state" ].indexOf(type) != -1)
		name = "";

	if(!city && suburb) {
		city = suburb;
		suburb = "";
	}

	if(road) {
		switch(countryCode) {
			case "pl":
				road = "ul. "+road;
				break;
		}
	}

	// Add house number to road
	if(road && housenumber) {
		switch(countryCode) {
			case "ar":
			case "at":
			case "ca":
			case "de":
			case "hr":
			case "cz":
			case "dk":
			case "fi":
			case "is":
			case "il":
			case "it":
			case "nl":
			case "no":
			case "pe":
			case "pl":
			case "sk":
			case "si":
			case "se":
			case "tr":
				road += " "+housenumber;
				break;
			case "be":
			case "es":
				road += ", "+housenumber;
				break;
			case "cl":
				road += " N° "+housenumber;
				break;
			case "hu":
				road += " "+housenumber+".";
				break;
			case "id":
				road += " No. "+housenumber;
				break;
			case "my":
				road = "No." +housenumber+", "+road;
				break;
			case "ro":
				road += ", nr. "+housenumber;
				break;
			case "au":
			case "fr":
			case "hk":
			case "ie":
			case "in":
			case "nz":
			case "sg":
			case "lk":
			case "tw":
			case "gb":
			case "us":
			default:
				road = housenumber+" "+road;
				break;
		}
	}

	// Add postcode and districts to city
	switch(countryCode) {
		case "ar":
			if(postcode && city)
				city = postcode+", "+city;
			else if(postcode)
				city = postcode;
			break;
		case "at":
		case "ch":
		case "de":
			if(city) {
				if(suburb)
					city += "-"+(suburb);
				suburb = undefined;
				if(type == "suburb" || type == "residential")
					type = "city";

				if(postcode)
					city = postcode+" "+city;
			} else if (postcode)
				city = postcode;
			break;
		case "be":
		case "hr":
		case "cz":
		case "dk":
		case "fi":
		case "fr":
		case "hu":
		case "is":
		case "il":
		case "my":
		case "nl":
		case "no":
		case "sk":
		case "si":
		case "es":
		case "se":
		case "tr":
			if(city && postcode)
				city = postcode+" "+city;
			else if (postcode)
				city = postcode;
			break;
		case "au":
		case "ca":
		case "us":
			if(city && state)
			{
				const thisStateAbbr = stateAbbr[countryCode][state.toLowerCase()];
				if(thisStateAbbr)
				{
					city += " "+thisStateAbbr;
					state = undefined;
				}
			}
			if(city && postcode)
				city += " "+postcode;
			else if(postcode)
				city = postcode;
			break;
		case "it":
			if(city)
			{
				if(county)
				{
					const countyAbbr = stateAbbr.it[county.toLowerCase().replace(/ì/g, "i")];
					if(countyAbbr)
					{
						city += " ("+countyAbbr+")";
						county = undefined;
					}
				}
				if(postcode)
					city  = postcode+" "+city;
			} else if (postcode)
				city = postcode;
			break;
		case "ro":
			if(city && county)
			{
				city += ", jud. "+county;
				county = undefined;
			}
			if(city && postcode)
				city += ", "+postcode;
			else if (postcode)
				city = postcode;
			break;
		case "cl":
		case "hk": // Postcode rarely/not used
		case "ie":
		case "in":
		case "id":
		case "nz":
		case "pe":
		case "sg":
		case "lk":
		case "tw":
		case "gb":
		default:
			if(city && postcode)
				city = city+" "+postcode;
			else if(postcode)
				city = postcode;
			break;
	}

	const address = [ ];

	if(road)
		address.push(road);
	if(suburb)
		address.push(suburb);
	if(city)
		address.push(city);
	if(["residential", "town", "suburb", "village", "hamlet", "residential", "city", "county", "state"].includes(type) || address.length == 0)
	{ // Searching for a town
		if(county && county != city)
			address.push(county);
		if(state && state != city)
			address.push(state);
	}

	if(country)
		address.push(country);

	const fullName = [ ...address ];
	if(name && name != address[0])
		fullName.unshift(name);

	return {
		address: address.join(", "),
		nameWithAddress: fullName.join(", "),
		name: fullName[0]
	};
}

async function _loadUrl(url: string, completeOsmObjects = false) {
	let bodyBuf = await fetch(
		url,
		{
			headers: {
				"User-Agent": config.userAgent
			}
		}
	).then((res) => res.buffer());

	if(!bodyBuf)
		throw new Error("Invalid response from server.");

	if(bodyBuf[0] == 0x42 && bodyBuf[1] == 0x5a && bodyBuf[2] == 0x68) {// bzip2
		bodyBuf = Buffer.from(compressjs.Bzip2.decompressFile(bodyBuf));
	}
	else if(bodyBuf[0] == 0x1f && bodyBuf[1] == 0x8b && bodyBuf[2] == 0x08) // gzip
		bodyBuf = await util.promisify(zlib.gunzip.bind(zlib))(bodyBuf);

	const body = stripBomBuf(bodyBuf).toString();

	if(url.match(/^https?:\/\/www\.freietonne\.de\/seekarte\/getOpenLayerPois\.php\?/))
		return body;
	else if(body.match(/^\s*</)) {
		const $ = cheerio.load(body, { xmlMode: true });
		const rootEl = $.root().children();

		if(rootEl.is("osm") && completeOsmObjects) {
			await _loadSubRelations($);
			return $.xml();
		} else if(rootEl.is("gpx,kml,osm"))
			return body;
		else
			throw new Error("Unknown file format.");
	} else if(body.match(/^\s*\{/)) {
		const content = JSON.parse(body);
		if(content.type)
			return body;
		else
			throw new Error("Unknown file format.");
	} else {
		throw new Error("Unknown file format.");
	}
}

async function _loadSubRelations($: cheerio.Root) {
	const loadedIds = new Set<string>();

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const promises: Array<Promise<string>> = [ ];

		$("member[type='relation']").each(function(this: cheerio.Element) {
			const relId = $(this).attr("ref")!;
			if(!loadedIds.has(relId)) {
				$(this).remove(); // Remove relation from result, as it will be returned again as part of the sub request
				promises.push(fetch(
					"https://api.openstreetmap.org/api/0.6/relation/" + relId + "/full",
					{
						headers: {
							"User-Agent": config.userAgent
						}
					}
				).then((res) => res.text()));
				loadedIds.add(relId);
			}
		});

		if (promises.length == 0)
			return;

		if(promises.length > 0) {
			const relations = await Promise.all(promises);

			for (const relation of relations) {
				$.root().children().append(cheerio.load(relation, { xmlMode: true }).root().children().children());
			}
		}
	}
}
