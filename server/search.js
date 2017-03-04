var request = require("request-promise");
var Promise = require("bluebird");
var cheerio = require("cheerio");
var zlib = require("zlib");
var compressjs = require("compressjs");

var utils = require("./utils");

request = request.defaults({
	gzip: true,
	headers: {
		'User-Agent': process.env.fmUserAgent
	}
});

var nameFinderUrl = "https://nominatim.openstreetmap.org";
var limit = 25;
var stateAbbr = {
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

function find(query, loadUrls) {
	return Promise.resolve().then(function() {
		query = query.replace(/^\s+/, "").replace(/\s+$/, "");

		if(loadUrls) {
			var m = query.match(/^(node|way|relation)\s+(\d+)$/);
			if(m)
				return loadUrl("https://api.openstreetmap.org/api/0.6/" + m[1] + "/" + m[2] + (m[1] != "node" ? "/full" : ""), true);

			m = query.match(/^trace\s+(\d+)$/);
			if(m)
				return loadUrl("https://www.openstreetmap.org/trace/" + m[1] + "/data");

			if(query.match(/^https?:\/\//))
				return loadUrl(query);
		}

		var lonlat_match = query.match(/^(geo\s*:\s*)?(-?\s*\d+([.,]\d+)?)\s*[,;]\s*(-?\s*\d+([.,]\d+)?)(\s*\?z\s*=\s*(\d+))?$/);
		var osm_match = query.match(/^([nwr])(\d+)$/i);
		if(lonlat_match || osm_match)
		{ // Reverse search
			var url = nameFinderUrl + "/reverse?format=json&addressdetails=1&polygon_geojson=1&extratags=1&namedetails=1";
			var lonlat;

			if(lonlat_match) {
				lonlat = {
					lat: 1*lonlat_match[2].replace(",", ".").replace(/\s+/, ""),
					lon : 1*lonlat_match[4].replace(",", ".").replace(/\s+/, ""),
					zoom : lonlat_match[7] != null ? 1*lonlat_match[7] : null
				};
				url += "&lat=" + lonlat.lat
					+ "&lon=" + lonlat.lon
					+ "&zoom=" + (lonlat.zoom != null ? (lonlat.zoom >= 12 ? lonlat.zoom+2 : lonlat.zoom) : 17);
			} else {
				url += "&osm_type=" + osm_match[1].toUpperCase()
					+ "&osm_id=" + osm_match[2]
			}

			return request({
				url: url,
				json: true
			}).then(function(body) {
				if(!body || body.error) {
					if(lonlat) {
						var name = utils.round(lonlat.lat, 5) + ", " + utils.round(lonlat.lon, 5);
						return [ {
							lat: lonlat.lat,
							lon : lonlat.lon,
							type : "coordinates",
							short_name: name,
							display_name : name,
							zoom: lonlat.zoom != null ? lonlat.zoom : 15,
							icon: null
						} ];
					} else
						throw body ? body.error : "Invalid response from name finder";
				}

				if(lonlat) {
					body.lat = lonlat.lat;
					body.lon = lonlat.lon;

					if(lonlat.zoom != null)
						body.zoom = lonlat.zoom;
				}

				var res = prepareSearchResult(body);

				if(lonlat)
					res.id = query;

				return [ res ];
			});
		}

		return request({
			url: nameFinderUrl + "/search?format=jsonv2&polygon_geojson=1&addressdetails=1&namedetails=1&limit=" + encodeURIComponent(limit) + "&extratags=1&q=" + encodeURIComponent(query),
			json: true
		}).then(function(body) {
			if(!body)
				throw "Invalid response from name finder.";

			if(body.error)
				throw body.error;

			return body.map(prepareSearchResult);
		});
	});
}

function prepareSearchResult(result) {
	var displayName = makeDisplayName(result);
	return {
		short_name: result.namedetails.name || displayName.split(',')[0],
		display_name: displayName,
		boundingbox: result.boundingbox,
		lat: result.lat,
		lon: result.lon,
		zoom: result.zoom,
		extratags: result.extratags,
		geojson: result.geojson,
		icon: result.icon && result.icon.replace(/^.*\/([a-z0-9_]+)\.[a-z0-9]+\.[0-9]+\.[a-z0-9]+$/i, "$1"),
		type: result.type == "yes" ? result.category : result.type,
		id: result.osm_id ? result.osm_type.charAt(0) + result.osm_id : null
	};
}

/**
 * Tries to format a search result in a readable way according to the address notation habits in
 * the appropriate country.
 * @param result {Object} A place object as returned by Nominatim
 * @return {String} A readable name for the search result
 */
function makeDisplayName(result) {
	// See http://en.wikipedia.org/wiki/Address_%28geography%29#Mailing_address_format_by_country for
	// address notation guidelines

	var type = result.type;
	var name = result.namedetails.name;
	var countryCode = result.address.country_code;

	var road = result.address.road;
	var housenumber = result.address.house_number;
	var suburb = result.address.town || result.address.suburb || result.address.village || result.address.hamlet || result.address.residential;
	var postcode = result.address.postcode;
	var city = result.address.city;
	var county = result.address.county;
	var state = result.address.state;
	var country = result.address.country;

	if([ "road", "residential", "town", "suburb", "village", "hamlet", "residential", "city", "county", "state" ].indexOf(type) != -1)
		name = "";

	if(!city && suburb)
	{
		city = suburb;
		suburb = "";
	}

	if(road)
	{
		switch(countryCode)
		{
			case "pl":
				road = "ul. "+road;
				break;
			case "ro":
				road = "str. "+road;
				break;
		}
	}

	// Add house number to road
	if(road && housenumber)
	{
		switch(countryCode)
		{
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
				road += ", nr. "+road;
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
				road += housenumber+" "+road;
				break;
		}
	}

	// Add postcode and districts to city
	switch(countryCode)
	{
		case "ar":
			if(postcode && city)
				city = postcode+", "+city;
			else if(postcode)
				city = postcode;
			break;
		case "at":
		case "ch":
		case "de":
			if(city)
			{
				if(suburb)
					city += "-"+(suburb);
				suburb = null;
				if(type == "suburb" || type == "residential")
					type = "city";

				if(postcode)
					city = postcode+" "+city;
			}
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
			break;
		case "au":
		case "ca":
		case "us":
			if(city && state)
			{
				var thisStateAbbr = stateAbbr[countryCode][state.toLowerCase()];
				if(thisStateAbbr)
				{
					city += " "+thisStateAbbr;
					state = null;
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
					var countyAbbr = stateAbbr.it[county.toLowerCase().replace(/ì/g, "i")];
					if(countyAbbr)
					{
						city += " ("+countyAbbr+")";
						county = null;
					}
				}
				if(postcode)
					city  = postcode+" "+city;
			}
			break;
		case "ro":
			if(city && county)
			{
				city += ", jud. "+county;
				county = null;
			}
			if(city && postcode)
				city += ", "+postcode;
			break;
		case "cl":
		case "hk":
			// Postcode rarely/not used
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

	var ret = [ ];

	if(name)
		ret.push(name);
	if(road)
		ret.push(road);
	if(suburb)
		ret.push(suburb);
	if(city)
		ret.push(city);
	if([ "residential", "town", "suburb", "village", "hamlet", "residential", "city", "county", "state" ].indexOf(type) != -1)
	{ // Searching for a town
		if(county && county != city)
			ret.push(county);
		if(state && state != city)
			ret.push(state);
	}

	if(country)
		ret.push(country);

	return ret.join(", ");
}

function loadUrl(url, completeOsmObjects) {
	return request(url, { encoding: null }).then(function(bodyBuf) {
		if(!bodyBuf)
			throw "Invalid response from server.";

		if(bodyBuf[0] == 0x42 && bodyBuf[1] == 0x5a && bodyBuf[2] == 0x68) {// bzip2
			return new Buffer(compressjs.Bzip2.decompressFile(bodyBuf));
		}
		else if(bodyBuf[0] == 0x1f && bodyBuf[1] == 0x8b && bodyBuf[2] == 0x08) // gzip
			return Promise.promisify(zlib.gunzip.bind(zlib))(bodyBuf);
		else
			return bodyBuf;
	}).then(function(bodyBuf) {
		var body = bodyBuf.toString();

		if(url.match(/^https?:\/\/www\.freietonne\.de\/seekarte\/getOpenLayerPois\.php\?/))
			return body;
		else if(body.match(/^\s*</)) {
			var $ = cheerio.load(body, { xmlMode: true });
			var rootEl = $.root().children();

			if(rootEl.is("osm") && completeOsmObjects) {
				return _loadSubRelations($).then(function() { return $.xml(); });
			} else if(rootEl.is("gpx,kml,osm"))
				return body;
			else
				throw "Unknown file format.";
		} else if(body.match(/^\s*\{/)) {
			var content = JSON.parse(body);
			if(content.type)
				return body;
			else
				throw "Unknown file format.";
		} else {
			throw "Unknown file format.";
		}
	});
}

function _loadSubRelations($) {
	var ret = [ ];
	$("member[type='relation']").each(function() {
		var relId = $(this).attr("ref");
		if($("relation[id='" + relId + "']").length == 0) {
			ret.push(request("https://api.openstreetmap.org/api/0.6/relation/" + relId + "/full"));
		}
	});

	if(ret.length > 0) {
		return Promise.all(ret).then(function(relations) {
			relations.forEach(function(relation) {
				$.root().children().append(cheerio.load(relation, { xmlMode: true }).root().children().children());
			});

			return _loadSubRelations($);
		});
	} else {
		return Promise.resolve();
	}
}

module.exports = {
	find: find
};