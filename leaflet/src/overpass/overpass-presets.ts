import { getI18n } from "../utils/i18n";

export interface OverpassPresetCategory {
	label: string;
	presets: OverpassPreset[][];
}

export interface OverpassPreset {
	key: string;
	label: string;
	query: string;
}

// These are mostly copied from OpenPoiMap. See https://github.com/marczoutendijk/openpoimap/blob/master/js_source/opm.js.
export function getAllOverpassPresets(): OverpassPresetCategory[] {
	const i18n = getI18n();
	return [
		{
			label: i18n.t("overpass-presets.category-amenities"),
			presets: [
				[
					{ key: "atm", query: "(nwr[amenity=atm];nwr[amenity=bank][atm][atm!=no];)", label: i18n.t("overpass-presets.atm") },
					{ key: "bank", query: "nwr[amenity=bank]", label: i18n.t("overpass-presets.bank") },
					{ key: "bench", query: "(node[amenity=bench];node(w);)", label: i18n.t("overpass-presets.bench") },
					{ key: "bicycleparking", query: "nwr[amenity=bicycle_parking]", label: i18n.t("overpass-presets.bicycleparking") },
					{ key: "bicyclerental", query: "nwr[amenity=bicycle_rental]", label: i18n.t("overpass-presets.bicyclerental") },
					{ key: "cinema", query: "nwr[amenity=cinema]", label: i18n.t("overpass-presets.cinema") },
					{ key: "clinic", query: "nwr[amenity=clinic]", label: i18n.t("overpass-presets.clinic") },
					{ key: "drinkingwater", query: "(nwr[amenity=drinking_water];nwr[man_made=water_tap][drinking_water=yes];nwr[man_made=drinking_fountain];nwr[man_made=water_well][drinking_water=yes];)", label: i18n.t("overpass-presets.drinkingwater") },
					{ key: "embassy", query: "nwr[amenity=embassy]", label: i18n.t("overpass-presets.embassy") },
					{ key: "firestation", query: "nwr[amenity=fire_station]", label: i18n.t("overpass-presets.firestation") },
					{ key: "fuel", query: "nwr[amenity=fuel]", label: i18n.t("overpass-presets.fuel") },
					{ key: "hospital", query: "nwr[amenity=hospital]", label: i18n.t("overpass-presets.hospital") },
					{ key: "library", query: "nwr[amenity=library]", label: i18n.t("overpass-presets.library") },
					{ key: "musicschool", query: "nwr[amenity=music_school]", label: i18n.t("overpass-presets.musicschool") },
					{ key: "parking", query: "nwr[amenity=parking]", label: i18n.t("overpass-presets.parking") },
					{ key: "pharmacy", query: "nwr[amenity=pharmacy]", label: i18n.t("overpass-presets.pharmacy") },
					{ key: "police", query: "nwr[amenity=police]", label: i18n.t("overpass-presets.police") },
					{ key: "postbox", query: "(node[amenity=post_box];node(w);)", label: i18n.t("overpass-presets.postbox") },
					{ key: "postoffice", query: "nwr[amenity=post_office]", label: i18n.t("overpass-presets.postoffice") },
					{ key: "school", query: "nwr[amenity~'^school$|^college$']", label: i18n.t("overpass-presets.school") },
					{ key: "shower", query: "(nwr[amenity=shower];nwr[shower=yes];)", label: i18n.t("overpass-presets.shower") },
					{ key: "taxi", query: "nwr[amenity=taxi]", label: i18n.t("overpass-presets.taxi") },
					{ key: "theatre", query: "nwr[amenity=theatre]", label: i18n.t("overpass-presets.theatre") },
					{ key: "toilets", query: "nwr[amenity=toilets]", label: i18n.t("overpass-presets.toilets") },
					{ key: "university", query: "nwr[amenity=university]", label: i18n.t("overpass-presets.university") },
					{ key: "watertap", query: "(nwr[man_made=water_tap];nwr[man_made=water_well][pump][pump!=no];nwr[amenity=water_point];nwr[waterway=water_point];)", label: i18n.t("overpass-presets.watertap") },
				], [
					// Check for various religions. We check on 5 religions AND also on a general place_of_worship but excluding the others.
					// zaterdag 9 januari 2016 Included rel for the stand-alone religions
					{ key: "worship", query: "nwr[amenity=place_of_worship][religion!~'christian|muslim|buddhist|hindu|jewish']", label: i18n.t("overpass-presets.worship") },
					{ key: "church", query: "nwr[amenity=place_of_worship][religion=christian]", label: i18n.t("overpass-presets.church") },
					{ key: "mosque", query: "nwr[amenity=place_of_worship][religion=muslim]", label: i18n.t("overpass-presets.mosque") },
					{ key: "buddhist", query: "nwr[amenity=place_of_worship][religion=buddhist]", label: i18n.t("overpass-presets.buddhist") },
					{ key: "hindu", query: "nwr[amenity=place_of_worship][religion=hindu]", label: i18n.t("overpass-presets.hindu") },
					{ key: "synagogue", query: "nwr[amenity=place_of_worship][religion=jewish]", label: i18n.t("overpass-presets.synagogue") },
					// Check only for cemetery for human beings
					{ key: "cemetery", query: "nwr[landuse=cemetery][animal!~'.']", label: i18n.t("overpass-presets.cemetery") }
				], [
					{ key: "amenities", query: "nwr[amenity]", label: i18n.t("overpass-presets.amenities") }
				]
			]
		},
		{
			label: i18n.t("overpass-presets.category-tourism"),
			presets: [
				[
					// places to see
					{ key: "abandoned", query: `(nwr[~"^abandoned(:|$)"~"."][!"abandoned:highway"];nwr[~"^ruins(:|$)"~"."];)`, label: i18n.t("overpass-presets.abandoned") },
					{ key: "artscentre", query: "nwr[amenity=arts_centre]", label: i18n.t("overpass-presets.artscentre") },
					{ key: "artwork", query: "nwr[tourism=artwork][artwork_type!~'statue']", label: i18n.t("overpass-presets.artwork") },
					{ key: "attraction", query: "nwr[tourism=attraction]", label: i18n.t("overpass-presets.attraction") },
					{ key: "casino", query: "nwr[amenity=casino]", label: i18n.t("overpass-presets.casino") },
					{ key: "castle", query: "nwr[historic=castle]", label: i18n.t("overpass-presets.castle") },
					{ key: "cave", query: "nwr[natural=cave_entrance]", label: i18n.t("overpass-presets.cave") },
					{ key: "gallery", query: "nwr[tourism=gallery]", label: i18n.t("overpass-presets.gallery") },
					{ key: "heritage", query: "nwr[heritage]", label: i18n.t("overpass-presets.heritage") },
					// Check for all historic tags but exclude those that already have their own
					{ key: "historic", query: "nwr[historic][historic!~'memorial|monument|statue|castle']", label: i18n.t("overpass-presets.historic") },
					{ key: "hotspring", query: "nwr[natural=hot_spring]", label: i18n.t("overpass-presets.hotspring") },
					{ key: "touristinformation", query: "nwr[tourism=information]", label: i18n.t("overpass-presets.touristinformation") },
					{ key: "monument", query: "nwr[historic~'^monument$|^memorial$']", label: i18n.t("overpass-presets.monument") },
					{ key: "monumentaltree", query: "nwr[natural=tree][monument=yes]", label: i18n.t("overpass-presets.monumentaltree") },
					{ key: "museum", query: "nwr[tourism=museum]", label: i18n.t("overpass-presets.museum") },
					{ key: "nudism", query: "nwr[nudism][nudism!=no]", label: i18n.t("overpass-presets.nudism") },
					{ key: "picnic", query: "(nwr[tourism=picnic_site];nwr[leisure=picnic_table];)", label: i18n.t("overpass-presets.picnic") },
					{ key: "sauna", query: "nwr[leisure=sauna]", label: i18n.t("overpass-presets.sauna") },
					{ key: "spa", query: "nwr[leisure=spa]", label: i18n.t("overpass-presets.spa") },
					{ key: "statue", query: "(nwr[historic=statue];nwr[landmark=statue];nwr[tourism=artwork][artwork_type=statue];)", label: i18n.t("overpass-presets.statue") },
					{ key: "themepark", query: "nwr[tourism=theme_park]", label: i18n.t("overpass-presets.themepark") },
					{ key: "viewpoint", query: "nwr[tourism=viewpoint]", label: i18n.t("overpass-presets.viewpoint") },
					{ key: "vineyard", query: "nwr[landuse=vineyard]", label: i18n.t("overpass-presets.vineyard") },
					{ key: "windmill", query: "nwr[man_made=windmill]", label: i18n.t("overpass-presets.windmill") },
					{ key: "watermill", query: "nwr[man_made=watermill]", label: i18n.t("overpass-presets.watermill") },
					{ key: "zoo", query: "nwr[tourism=zoo]", label: i18n.t("overpass-presets.zoo") },
				],
				[
					// Places to stay
					{ key: "alpinehut", query: "nwr[tourism=alpine_hut]", label: i18n.t("overpass-presets.alpinehut") },
					{ key: "apartment", query: "nwr[tourism=apartment]", label: i18n.t("overpass-presets.apartment") },
					{ key: "campsite", query: "nwr[tourism=camp_site][backcountry!=yes]", label: i18n.t("overpass-presets.campsite") },
					{ key: "chalet", query: "nwr[tourism=chalet]", label: i18n.t("overpass-presets.chalet") },
					{ key: "guesthouse", query: "nwr[tourism~'guest_house|bed_and_breakfast']", label: i18n.t("overpass-presets.guesthouse") },
					{ key: "hostel", query: "nwr[tourism=hostel]", label: i18n.t("overpass-presets.hostel") },
					{ key: "hotel", query: "nwr[tourism=hotel]", label: i18n.t("overpass-presets.hotel") },
					{ key: "motel", query: "nwr[tourism=motel]", label: i18n.t("overpass-presets.motel") }
				],
				[
					{ key: "tourism", query: "nwr[tourism]", label: i18n.t("overpass-presets.tourism") }
				]
			]
		},
		{
			label: i18n.t("overpass-presets.category-sports"),
			presets: [
				[
					{ key: "americanfootball", query: "nwr[sport=american_football]", label: i18n.t("overpass-presets.americanfootball") },
					{ key: "baseball", query: "nwr[sport=baseball]", label: i18n.t("overpass-presets.baseball") },
					{ key: "basketball", query: "nwr[sport=basketball]", label: i18n.t("overpass-presets.basketball") },
					{ key: "cycling", query: "nwr[sport=cycling]", label: i18n.t("overpass-presets.cycling") },
					{ key: "gymnastics", query: "nwr[sport=gymnastics]", label: i18n.t("overpass-presets.gymnastics") },
					{ key: "golfcourse", query: "(nwr[leisure=golf_course];nwr[sport=golf];)", label: i18n.t("overpass-presets.golfcourse") },
					{ key: "hockey", query: "(nwr[sport=hockey];nwr[sport=field_hockey];)", label: i18n.t("overpass-presets.hockey") },
					{ key: "horseracing", query: "nwr[sport=horse_racing]", label: i18n.t("overpass-presets.horseracing") },
					{ key: "horseriding", query: "(nwr[sport=equestrian];nwr[leisure=horse_riding];)", label: i18n.t("overpass-presets.horseriding") },
					{ key: "icehockey", query: "(nwr[sport=ice_hockey];nwr[leisure=ice_rink];)", label: i18n.t("overpass-presets.icehockey") },
					{ key: "soccer", query: "nwr[sport=soccer]", label: i18n.t("overpass-presets.soccer") },
					{ key: "sportscentre", query: "nwr[leisure=sports_centre]", label: i18n.t("overpass-presets.sportscentre") },
					{ key: "surfing", query: "nwr[sport=surfing]", label: i18n.t("overpass-presets.surfing") },
					{ key: "swimming", query: "nwr[sport=swimming]", label: i18n.t("overpass-presets.swimming") },
					{ key: "tabletennis", query: "nwr[sport=table_tennis]", label: i18n.t("overpass-presets.tabletennis") },
					{ key: "tennis", query: "nwr[sport=tennis]", label: i18n.t("overpass-presets.tennis") },
					{ key: "volleyball", query: "nwr[sport=volleyball]", label: i18n.t("overpass-presets.volleyball") }
				],
				[
					{ key: "sports", query: "nwr[sport]", label: i18n.t("overpass-presets.sports") }
				]
			]
		},
		{
			label: i18n.t("overpass-presets.category-shops"),
			presets: [
				[
					// food shops
					{ key: "alcoholshop", query: "nwr[shop=alcohol]", label: i18n.t("overpass-presets.alcoholshop") },
					{ key: "bakery", query: "nwr[shop=bakery]", label: i18n.t("overpass-presets.bakery") },
					{ key: "beverageshop", query: "nwr[shop=beverages]", label: i18n.t("overpass-presets.beverageshop") },
					{ key: "butcher", query: "nwr[shop=butcher]", label: i18n.t("overpass-presets.butcher") },
					{ key: "cheeseshop", query: "nwr[shop=cheese]", label: i18n.t("overpass-presets.cheeseshop") },
					{ key: "confectionery", query: "nwr[shop~'chocolate|confectionery']", label: i18n.t("overpass-presets.confectionery") },
					{ key: "coffeeshop", query: "nwr[shop=coffee]", label: i18n.t("overpass-presets.coffeeshop") },
					{ key: "dairyshop", query: "nwr[shop=dairy]", label: i18n.t("overpass-presets.dairyshop") },
					{ key: "delishop", query: "(nwr[shop=deli];nwr[shop=delicatessen];)", label: i18n.t("overpass-presets.delishop") },
					{ key: "groceryshop", query: "nwr[shop=grocery]", label: i18n.t("overpass-presets.groceryshop") },
					{ key: "organicshop", query: "(nwr[shop=organic];nwr[shop=supermarket][organic=only];)", label: i18n.t("overpass-presets.organicshop") },
					{ key: "seafoodshop", query: "nwr[shop=seafood]", label: i18n.t("overpass-presets.seafoodshop") },
					{ key: "supermarket", query: "nwr[shop=supermarket]", label: i18n.t("overpass-presets.supermarket") },
					{ key: "wineshop", query: "nwr[shop=wine]", label: i18n.t("overpass-presets.wineshop") }
				],
				[
					//Various shops (excluding food)
					{ key: "beautyshop", query: "nwr[shop=beauty]", label: i18n.t("overpass-presets.beautyshop") },
					{ key: "bicycleshop", query: "nwr[shop=bicycle]", label: i18n.t("overpass-presets.bicycleshop") },
					{ key: "bookshop", query: "nwr[shop~'books|stationary']", label: i18n.t("overpass-presets.bookshop") },
					{ key: "carshop", query: "nwr[shop=car]", label: i18n.t("overpass-presets.carshop") },
					{ key: "chemist", query: "nwr[shop=chemist]", label: i18n.t("overpass-presets.chemist") },
					{ key: "clothesshop", query: "nwr[shop=clothes]", label: i18n.t("overpass-presets.clothesshop") },
					{ key: "copyshop", query: "nwr[shop=copyshop]", label: i18n.t("overpass-presets.copyshop") },
					{ key: "cosmeticsshop", query: "nwr[shop=cosmetics]", label: i18n.t("overpass-presets.cosmeticsshop") },
					{ key: "departmentstore", query: "nwr[shop=department_store]", label: i18n.t("overpass-presets.departmentstore") },
					{ key: "diyshop", query: "nwr[shop~'doityourself|hardware']", label: i18n.t("overpass-presets.diyshop") },
					{ key: "florist", query: "(nwr[shop=florist];nwr[shop=garden_centre];)", label: i18n.t("overpass-presets.florist") },
					{ key: "gardencentre", query: "nwr[shop=garden_centre]", label: i18n.t("overpass-presets.gardencentre") },
					{ key: "generalshop", query: "nwr[shop=general]", label: i18n.t("overpass-presets.generalshop") },
					{ key: "giftshop", query: "nwr[shop=gift]", label: i18n.t("overpass-presets.giftshop") },
					{ key: "hairdresser", query: "nwr[shop=hairdresser]", label: i18n.t("overpass-presets.hairdresser") },
					// See tagging-list january 2016
					{ key: "jewelleryshop", query: "nwr[shop~'jewelry|jewellery']", label: i18n.t("overpass-presets.jewelleryshop") },
					{ key: "kiosk", query: "nwr[shop=kiosk]", label: i18n.t("overpass-presets.kiosk") },
					{ key: "leathershop", query: "nwr[shop=leather]", label: i18n.t("overpass-presets.leathershop") },
					{ key: "marketplace", query: "nwr[amenity=marketplace]", label: i18n.t("overpass-presets.marketplace") },
					{ key: "musicshop", query: "nwr[shop=musical_instrument]", label: i18n.t("overpass-presets.musicshop") },
					{ key: "optician", query: "nwr[shop=optician]", label: i18n.t("overpass-presets.optician") },
					{ key: "petshop", query: "nwr[shop=pet]", label: i18n.t("overpass-presets.petshop") },
					{ key: "phoneshop", query: "nwr[shop=mobile_phone]", label: i18n.t("overpass-presets.phoneshop") },
					{ key: "photoshop", query: "nwr[shop=photo]", label: i18n.t("overpass-presets.photoshop") },
					{ key: "shoeshop", query: "nwr[shop=shoes]", label: i18n.t("overpass-presets.shoeshop") },
					{ key: "mall", query: "nwr[shop=mall]", label: i18n.t("overpass-presets.mall") },
					{ key: "textileshop", query: "nwr[shop=fabric]", label: i18n.t("overpass-presets.textileshop") },
					{ key: "toyshop", query: "nwr[shop=toys]", label: i18n.t("overpass-presets.toyshop") }
				],
				[
					{ key: "shops", query: "nwr[shop]", label: i18n.t("overpass-presets.shops") }
				]
			]
		},
		{
			label: i18n.t("overpass-presets.category-restaurants"),
			presets: [
				[
					// places to eat
					{ key: "bar", query: "nwr[amenity=bar]", label: i18n.t("overpass-presets.bar") },
					{ key: "bbq", query: "nwr[amenity=bbq]", label: i18n.t("overpass-presets.bbq") },
					{ key: "biergarten", query: "nwr[amenity=biergarten]", label: i18n.t("overpass-presets.biergarten") },
					{ key: "cafe", query: "nwr[amenity=cafe]", label: i18n.t("overpass-presets.cafe") },
					{ key: "fastfood", query: "nwr[amenity=fast_food]", label: i18n.t("overpass-presets.fastfood") },
					{ key: "foodcourt", query: "nwr[amenity=food_court]", label: i18n.t("overpass-presets.foodcourt") },
					{ key: "icecream", query: "(nwr[amenity=ice_cream];nwr[cuisine=ice_cream];)", label: i18n.t("overpass-presets.icecream") },
					{ key: "pub", query: "nwr[amenity=pub]", label: i18n.t("overpass-presets.pub") },
					{ key: "restaurant", query: "nwr[amenity=restaurant]", label: i18n.t("overpass-presets.restaurant") }
				]
			]
		},
		{
			label: i18n.t("overpass-presets.category-various"),
			presets: [
				[
					{ key: "busstop", query: "nwr[highway=bus_stop]", label: i18n.t("overpass-presets.busstop") },
					{ key: "bicyclecharging", query: "nwr[amenity=charging_station][bicycle=yes]", label: i18n.t("overpass-presets.bicyclecharging") },
					{ key: "kindergarten", query: "nwr[amenity~'childcare|kindergarten']", label: i18n.t("overpass-presets.kindergarten") },
					{ key: "marketplace", query: "nwr[amenity=marketplace]", label: i18n.t("overpass-presets.marketplace") },
					{ key: "office", query: "nwr[office]", label: i18n.t("overpass-presets.office") },
					{ key: "recycling", query: "nwr[amenity=recycling]", label: i18n.t("overpass-presets.recycling") },
					{ key: "travelagency", query: "nwr[shop=travel_agency]", label: i18n.t("overpass-presets.travelagency") }
				],
				[
					{ key: "defibrillator", query: "nwr[emergency=defibrillator]", label: i18n.t("overpass-presets.defibrillator") },
					{ key: "fireextinguisher", query: "(node[emergency=fire_extinguisher];node[emergency=fire_hose];)", label: i18n.t("overpass-presets.fireextinguisher") },
				],
				[
					// Do not include a relation for the fixme, as it produces a lot of extraneous data
					{ key: "fixme", query: "(nw[fixme];nw[FIXME];)", label: i18n.t("overpass-presets.fixme") },
					//	{ key: "", query: "(node[~'^fixme$',i];way[~'^fixme$',i];)", label: i18n.t("overpass-presets.") },
					{ key: "notenode", query: "node[note]", label: i18n.t("overpass-presets.notenode") },
					{ key: "noteway", query: "way[note]", label: i18n.t("overpass-presets.noteway") },
					{ key: "construction", query: "nw[highway=construction]", label: i18n.t("overpass-presets.construction") },
					{ key: "image", query: "nw[image]", label: i18n.t("overpass-presets.image") },
					{ key: "camera", query: "node['surveillance:type'~'camera|webcam']", label: i18n.t("overpass-presets.camera") },
				],
				[
					{ key: "city", query: "node[place=city]", label: i18n.t("overpass-presets.city") },
					{ key: "town", query: "node[place=town]", label: i18n.t("overpass-presets.town") },
					{ key: "village", query: "node[place=village]", label: i18n.t("overpass-presets.village") },
					{ key: "hamlet", query: "node[place=hamlet]", label: i18n.t("overpass-presets.hamlet") },
					{ key: "suburb", query: "node[place=suburb]", label: i18n.t("overpass-presets.suburb") }

					//	{ key: "", query: "(way[name~'^[Ff]ietspad'];)->.fietspaden;(way(foreach.fietspaden)[highway=cycleway][name][name~'^[Ff]ietspad$'])", naam:"fietspad" }
					//	{ key: "", query: "(way[name~'^Fietspad|^fietspad|^pad$|^Pad$|cycleway|^path$|^Path$'];node(w);way[highway=cycleway][name!~'.'];node(w);)", naam:"fietspad" }
				]
			]
		}
	]
};
// For backwards compatibility. Does not provide i18n reactivity.
export const overpassPresets = getAllOverpassPresets();

export function getOverpassPreset(key: string): OverpassPreset | undefined {
	return getAllOverpassPresets().map((p) => p.presets).flat().flat().find((p) => p.key == key) as OverpassPreset | undefined;
}

export function getOverpassPresets(keys: string[]): OverpassPreset[] {
	return getAllOverpassPresets().map((p) => p.presets).flat().flat().filter((p) => keys.includes(p.key)) as OverpassPreset[];
}