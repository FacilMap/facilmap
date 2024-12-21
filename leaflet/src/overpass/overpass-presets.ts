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
					{ key: "drinkingwater", query: "nwr[amenity=drinking_water]", label: i18n.t("overpass-presets.drinkingwater") },
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
					{ key: "university", query: "nwr[amenity=university]", label: i18n.t("overpass-presets.university") }
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
					{ key: "artscentre", query: "(node[amenity=arts_centre];way[amenity=arts_centre];rel[amenity=arts_centre];)", label: i18n.t("overpass-presets.artscentre") },
					{ key: "artwork", query: "(node[tourism=artwork][artwork_type!~'statue'];way[tourism=artwork];rel[tourism=artwork];)", label: i18n.t("overpass-presets.artwork") },
					{ key: "attraction", query: "(node[tourism=attraction];way[tourism=attraction];rel[tourism=attraction];)", label: i18n.t("overpass-presets.attraction") },
					{ key: "casino", query: "(node[leisure=casino];way[leisure=casino];rel[leisure=casino];)", label: i18n.t("overpass-presets.casino") },
					{ key: "castle", query: "(node[historic=castle];way[historic=castle];rel[historic=castle];)", label: i18n.t("overpass-presets.castle") },
					{ key: "cave", query: "nwr[natural=cave_entrance]", label: i18n.t("overpass-presets.cave") },
					{ key: "gallery", query: "(node[tourism=gallery];way[tourism=gallery];rel[tourism=gallery];)", label: i18n.t("overpass-presets.gallery") },
					{ key: "heritage", query: "(node[heritage];way[heritage];rel[heritage];)", label: i18n.t("overpass-presets.heritage") },
					// Check for all historic tags but exclude those that already have their own
					{ key: "historic", query: "(node[historic][historic!~'memorial|monument|statue|castle'];way[historic][historic!~'memorial|monument|statue|castle'];rel[historic][historic!~'memorial|monument|statue|castle'];)", label: i18n.t("overpass-presets.historic") },
					{ key: "hotspring", query: "nwr[natural=hot_spring]", label: i18n.t("overpass-presets.hotspring") },
					{ key: "touristinformation", query: "(node[tourism=information];way[tourism=information];)", label: i18n.t("overpass-presets.touristinformation") },
					{ key: "monument", query: "(node[historic~'^monument$|^memorial$'];way[historic~'^monument$|^memorial$'];rel[historic~'^monument$|^memorial$'];)", label: i18n.t("overpass-presets.monument") },
					{ key: "monumentaltree", query: "(node[natural=tree][monument=yes];)", label: i18n.t("overpass-presets.monumentaltree") },
					{ key: "museum", query: "(node[tourism=museum];way[tourism=museum];rel[tourism=museum];)", label: i18n.t("overpass-presets.museum") },
					{ key: "nudism", query: "nwr[nudism][nudism!=no]", label: i18n.t("overpass-presets.nudism") },
					{ key: "picnic", query: "(node[tourism=picnic_site];way[tourism=picnic_site];rel[tourism=picnic_site];node[leisure=picnic_table];)", label: i18n.t("overpass-presets.picnic") },
					{ key: "sauna", query: "(node[leisure=sauna];way[leisure=sauna];rel[leisure=sauna];)", label: i18n.t("overpass-presets.sauna") },
					{ key: "spa", query: "(node[leisure=spa];way[leisure=spa];rel[leisure=spa];)", label: i18n.t("overpass-presets.spa") },
					{ key: "statue", query: "(node[historic=statue];node[landmark=statue];node[tourism=artwork][artwork_type=statue];)", label: i18n.t("overpass-presets.statue") },
					{ key: "themepark", query: "(node[tourism=theme_park];way[tourism=theme_park];rel[tourism=theme_park];)", label: i18n.t("overpass-presets.themepark") },
					{ key: "viewpoint", query: "(node[tourism=viewpoint];way[tourism=viewpoint];rel[tourism=viewpoint];)", label: i18n.t("overpass-presets.viewpoint") },
					{ key: "vineyard", query: "(node[landuse=vineyard];way[landuse=vineyard];rel[landuse=vineyard];)", label: i18n.t("overpass-presets.vineyard") },
					{ key: "windmill", query: "(node[man_made=windmill];way[man_made=windmill];rel[man_made=windmill];)", label: i18n.t("overpass-presets.windmill") },
					{ key: "watermill", query: "(node[man_made=watermill];way[man_made=watermill];rel[man_made=watermill];)", label: i18n.t("overpass-presets.watermill") },
					{ key: "zoo", query: "(node[tourism=zoo];way[tourism=zoo];rel[tourism=zoo];)", label: i18n.t("overpass-presets.zoo") },
				],
				[
					// Places to stay
					{ key: "alpinehut", query: "(node[tourism=alpine_hut];way[tourism=alpine_hut];rel[tourism=alpine_hut];)", label: i18n.t("overpass-presets.alpinehut") },
					{ key: "apartment", query: "(node[tourism=apartment];way[tourism=apartment];rel[tourism=apartment];)", label: i18n.t("overpass-presets.apartment") },
					{ key: "campsite", query: "(node[tourism=camp_site][backcountry!=yes];way[tourism=camp_site][backcountry!=yes];rel[tourism=camp_site][backcountry!=yes];)", label: i18n.t("overpass-presets.campsite") },
					{ key: "chalet", query: "(node[tourism=chalet];way[tourism=chalet];rel[tourism=chalet];)", label: i18n.t("overpass-presets.chalet") },
					{ key: "guesthouse", query: "(node[tourism~'guest_house|bed_and_breakfast'];way[tourism~'guest_house|bed_and_breakfast'];rel[tourism~'guest_house|bed_and_breakfast'];)", label: i18n.t("overpass-presets.guesthouse") },
					{ key: "hostel", query: "(node[tourism=hostel];way[tourism=hostel];rel[tourism=hostel];)", label: i18n.t("overpass-presets.hostel") },
					{ key: "hotel", query: "(node[tourism=hotel];way[tourism=hotel];rel[tourism=hotel];)", label: i18n.t("overpass-presets.hotel") },
					{ key: "motel", query: "(node[tourism=motel];way[tourism=motel];rel[tourism=motel];)", label: i18n.t("overpass-presets.motel") }
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
					{ key: "americanfootball", query: "(way[sport=american_football];way[sport=american_football];)", label: i18n.t("overpass-presets.americanfootball") },
					{ key: "baseball", query: "(way[sport=baseball];node[sport=baseball];)", label: i18n.t("overpass-presets.baseball") },
					{ key: "basketball", query: "(way[sport=basketball];node[sport=basketball];)", label: i18n.t("overpass-presets.basketball") },
					{ key: "cycling", query: "(way[sport=cycling];node[sport=cycling];rel[sport=cycling];)", label: i18n.t("overpass-presets.cycling") },
					{ key: "gymnastics", query: "(way[sport=gymnastics];node[sport=gymnastics];rel[sport=gymnastics];)", label: i18n.t("overpass-presets.gymnastics") },
					{ key: "golfcourse", query: "(way[leisure=golf_course];way[sport=golf];node[leisure=golf_course];node[sport=golf];rel[leisure=golf_course];rel[sport=golf];)", label: i18n.t("overpass-presets.golfcourse") },
					{ key: "hockey", query: "(way[sport=hockey];node[sport=hockey];rel[sport=hockey];way[sport=field_hockey];node[sport=field_hockey];rel[sport=field_hockey];)", label: i18n.t("overpass-presets.hockey") },
					{ key: "horseracing", query: "nwr[sport=horse_racing]", label: i18n.t("overpass-presets.horseracing") },
					{ key: "horseriding", query: "(nwr[sport=equestrian];nwr[leisure=horse_riding];)", label: i18n.t("overpass-presets.horseriding") },
					{ key: "icehockey", query: "(way[sport=ice_hockey];node[sport=ice_hockey];rel[sport=ice_hockey];way[leisure=ice_rink];node[leisure=ice_rink];)", label: i18n.t("overpass-presets.icehockey") },
					{ key: "soccer", query: "(way[sport=soccer];node[sport=soccer];rel[sport=soccer];)", label: i18n.t("overpass-presets.soccer") },
					{ key: "sportscentre", query: "(way[leisure=sports_centre];node[leisure=sports_centre];rel[leisure=sports_centre];)", label: i18n.t("overpass-presets.sportscentre") },
					{ key: "surfing", query: "(way[sport=surfing];node[sport=surfing];rel[sport=surfing];)", label: i18n.t("overpass-presets.surfing") },
					{ key: "swimming", query: "(way[sport=swimming];node[sport=swimming];rel[sport=swimming];)", label: i18n.t("overpass-presets.swimming") },
					{ key: "tabletennis", query: "(way[sport=table_tennis];node[sport=table_tennis];)", label: i18n.t("overpass-presets.tabletennis") },
					{ key: "tennis", query: "(way[sport=tennis];node[sport=tennis];)", label: i18n.t("overpass-presets.tennis") },
					{ key: "volleyball", query: "(way[sport=volleyball];node[sport=volleyball];)", label: i18n.t("overpass-presets.volleyball") }
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
					{ key: "alcoholshop", query: "(node[shop=alcohol];way[shop=alcohol];rel[shop=alcohol];)", label: i18n.t("overpass-presets.alcoholshop") },
					{ key: "bakery", query: "(node[shop=bakery];way[shop=bakery];)", label: i18n.t("overpass-presets.bakery") },
					{ key: "beverageshop", query: "(node[shop=beverages];way[shop=beverages];rel[shop=beverages];)", label: i18n.t("overpass-presets.beverageshop") },
					{ key: "butcher", query: "(node[shop=butcher];way[shop=butcher];rel[shop=butcher];)", label: i18n.t("overpass-presets.butcher") },
					{ key: "cheeseshop", query: "(node[shop=cheese];way[shop=cheese];rel[shop=cheese];)", label: i18n.t("overpass-presets.cheeseshop") },
					{ key: "confectionery", query: "(node[shop~'chocolate|confectionery'];way[shop~'chocolate|confectionery'];rel[shop~'chocolate|confectionery'];)", label: i18n.t("overpass-presets.confectionery") },
					{ key: "coffeeshop", query: "(node[shop=coffee];way[shop=coffee];rel[shop=coffee];)", label: i18n.t("overpass-presets.coffeeshop") },
					{ key: "dairyshop", query: "(node[shop=dairy];way[shop=dairy];)", label: i18n.t("overpass-presets.dairyshop") },
					{ key: "delishop", query: "(node[shop=deli];way[shop=deli];node[shop=delicatessen];way[shop=delicatessen];)", label: i18n.t("overpass-presets.delishop") },
					{ key: "groceryshop", query: "(node[shop=grocery];way[shop=grocery];)", label: i18n.t("overpass-presets.groceryshop") },
					{ key: "organicshop", query: "(node[shop=organic];way[shop=organic];rel[shop=organic];)", label: i18n.t("overpass-presets.organicshop") },
					{ key: "seafoodshop", query: "(node[shop=seafood];way[shop=seafood];rel[shop=seafood];)", label: i18n.t("overpass-presets.seafoodshop") },
					{ key: "supermarket", query: "(node[shop=supermarket];way[shop=supermarket];)", label: i18n.t("overpass-presets.supermarket") },
					{ key: "wineshop", query: "(node[shop=wine];way[shop=wine];rel[shop=wine];)", label: i18n.t("overpass-presets.wineshop") }
				],
				[
					//Various shops (excluding food)
					{ key: "beautyshop", query: "(node[shop=beauty];way[shop=beauty];rel[shop=beauty];)", label: i18n.t("overpass-presets.beautyshop") },
					{ key: "bicycleshop", query: "(node[shop=bicycle];way[shop=bicycle];rel[shop=bicycle];)", label: i18n.t("overpass-presets.bicycleshop") },
					{ key: "bookshop", query: "(node[shop~'books|stationary'];way[shop~'books|stationary'];rel[shop~'books|stationary'];)", label: i18n.t("overpass-presets.bookshop") },
					{ key: "carshop", query: "(node[shop=car];way[shop=car];rel[shop=car];)", label: i18n.t("overpass-presets.carshop") },
					{ key: "chemist", query: "(node[shop=chemist];way[shop=chemist];rel[shop=chemist];)", label: i18n.t("overpass-presets.chemist") },
					{ key: "clothesshop", query: "(node[shop=clothes];way[shop=clothes];rel[shop=clothes];)", label: i18n.t("overpass-presets.clothesshop") },
					{ key: "copyshop", query: "(node[shop=copyshop];way[shop=copyshop];rel[shop=copyshop];)", label: i18n.t("overpass-presets.copyshop") },
					{ key: "cosmeticsshop", query: "(node[shop=cosmetics];way[shop=cosmetics];rel[shop=cosmetics];)", label: i18n.t("overpass-presets.cosmeticsshop") },
					{ key: "departmentstore", query: "(node[shop=department_store];way[shop=department_store];rel[shop=department_store];)", label: i18n.t("overpass-presets.departmentstore") },
					{ key: "diyshop", query: "(node[shop~'doityourself|hardware'];way[shop~'doityourself|hardware'];rel[shop~'doityourself|hardware'];)", label: i18n.t("overpass-presets.diyshop") },
					{ key: "florist", query: "(nwr[shop=florist];nwr[shop=garden_centre];)", label: i18n.t("overpass-presets.florist") },
					{ key: "gardencentre", query: "(node[shop=garden_centre];way[shop=garden_centre];rel[shop=garden_centre];)", label: i18n.t("overpass-presets.gardencentre") },
					{ key: "generalshop", query: "(node[shop=general];way[shop=general];rel[shop=general];)", label: i18n.t("overpass-presets.generalshop") },
					{ key: "giftshop", query: "(node[shop=gift];way[shop=gift];rel[shop=gift];)", label: i18n.t("overpass-presets.giftshop") },
					{ key: "hairdresser", query: "(node[shop=hairdresser];way[shop=hairdresser];rel[shop=hairdresser];)", label: i18n.t("overpass-presets.hairdresser") },
					// See tagging-list january 2016
					{ key: "jewelleryshop", query: "(node[shop~'jewelry|jewellery'];way[shop~'jewelry|jewellery'];rel[shop~'jewelry|jewellery'];)", label: i18n.t("overpass-presets.jewelleryshop") },
					{ key: "kiosk", query: "(node[shop=kiosk];way[shop=kiosk];rel[shop=kiosk];)", label: i18n.t("overpass-presets.kiosk") },
					{ key: "leathershop", query: "(node[shop=leather];way[shop=leather];rel[shop=leather];)", label: i18n.t("overpass-presets.leathershop") },
					{ key: "marketplace", query: "(node[amenity=marketplace];way[amenity=marketplace];rel[amenity=marketplace];)", label: i18n.t("overpass-presets.marketplace") },
					{ key: "musicshop", query: "(node[shop=musical_instrument];way[shop=musical_instrument];rel[shop=musical_instrument];)", label: i18n.t("overpass-presets.musicshop") },
					{ key: "optician", query: "(node[shop=optician];way[shop=optician];rel[shop=optician];)", label: i18n.t("overpass-presets.optician") },
					{ key: "petshop", query: "(node[shop=pets];way[shop=pets];rel[shop=pets];)", label: i18n.t("overpass-presets.petshop") },
					{ key: "phoneshop", query: "(node[shop=mobile_phone];way[shop=mobile_phone];rel[shop=mobile_phone];)", label: i18n.t("overpass-presets.phoneshop") },
					{ key: "photoshop", query: "(node[shop=photo];way[shop=photo];rel[shop=photo];)", label: i18n.t("overpass-presets.photoshop") },
					{ key: "shoeshop", query: "(node[shop=shoes];way[shop=shoes];)", label: i18n.t("overpass-presets.shoeshop") },
					{ key: "mall", query: "(node[shop=mall];way[shop=mall];rel[shop=mall];)", label: i18n.t("overpass-presets.mall") },
					{ key: "textileshop", query: "(node[shop=textiles];way[shop=textiles];rel[shop=textiles];)", label: i18n.t("overpass-presets.textileshop") },
					{ key: "toyshop", query: "(node[shop=toys];way[shop=toys];rel[shop=toys];)", label: i18n.t("overpass-presets.toyshop") }
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
					{ key: "bar", query: "(node[amenity=bar];way[amenity=bar];rel[amenity=bar];)", label: i18n.t("overpass-presets.bar") },
					{ key: "bbq", query: "(node[amenity=bbq];way[amenity=bbq];)", label: i18n.t("overpass-presets.bbq") },
					{ key: "biergarten", query: "(node[amenity=biergarten];way[amenity=biergarten];)", label: i18n.t("overpass-presets.biergarten") },
					{ key: "cafe", query: "(node[amenity=cafe];way[amenity=cafe];rel[amenity=cafe];)", label: i18n.t("overpass-presets.cafe") },
					{ key: "fastfood", query: "(node[amenity=fast_food];way[amenity=fast_food];rel[amenity=fast_food];)", label: i18n.t("overpass-presets.fastfood") },
					{ key: "foodcourt", query: "(node[amenity=food_court];way[amenity=food_court];)", label: i18n.t("overpass-presets.foodcourt") },
					{ key: "icecream", query: "(node[amenity=ice_cream];way[amenity=ice_cream];rel[amenity=ice_cream];node[cuisine=ice_cream];way[cuisine=ice_cream];rel[cuisine=ice_cream];)", label: i18n.t("overpass-presets.icecream") },
					{ key: "pub", query: "(node[amenity=pub];way[amenity=pub];rel[amenity=pub];)", label: i18n.t("overpass-presets.pub") },
					{ key: "restaurant", query: "(node[amenity=restaurant];way[amenity=restaurant];rel[amenity=restaurant];)", label: i18n.t("overpass-presets.restaurant") }
				]
			]
		},
		{
			label: i18n.t("overpass-presets.category-various"),
			presets: [
				[
					{ key: "busstop", query: "(node[highway=bus_stop];)", label: i18n.t("overpass-presets.busstop") },
					{ key: "bicyclecharging", query: "(node[amenity=charging_station][bicycle=yes];rel[amenity=charging_station][bicycle=yes];)", label: i18n.t("overpass-presets.bicyclecharging") },
					{ key: "kindergarten", query: "(node[amenity~'childcare|kindergarten'];way[amenity~'childcare|kindergarten'];rel[amenity~'childcare|kindergarten'];)", label: i18n.t("overpass-presets.kindergarten") },
					{ key: "marketplace", query: "(node[amenity=marketplace];way[amenity=marketplace];rel[amenity=marketplace];)", label: i18n.t("overpass-presets.marketplace") },
					{ key: "office", query: "(node[office];way[office];rel[office];)", label: i18n.t("overpass-presets.office") },
					{ key: "recycling", query: "(node[amenity=recycling];way[amenity=recycling];rel[amenity=recycling];)", label: i18n.t("overpass-presets.recycling") },
					{ key: "travelagency", query: "(node[shop=travel_agency];way[shop=travel_agency];rel[shop=travel_agency];)", label: i18n.t("overpass-presets.travelagency") }
				],
				[
					{ key: "defibrillator", query: "(node[emergency=defibrillator];way[emergency=defibrillator];rel[emergency=defibrillator];)", label: i18n.t("overpass-presets.defibrillator") },
					{ key: "fireextinguisher", query: "(node[emergency=fire_extinguisher];node[emergency=fire_hose];)", label: i18n.t("overpass-presets.fireextinguisher") },
				],
				[
					// Do not include a relation for the fixme, as it produces a lot of extraneous data
					{ key: "fixme", query: "(node[fixme];way[fixme];node[FIXME];way[FIXME];)", label: i18n.t("overpass-presets.fixme") },
					//	{ key: "", query: "(node[~'^fixme$',i];way[~'^fixme$',i];)", label: i18n.t("overpass-presets.") },
					{ key: "notenode", query: "(node[note];way[note];)", label: i18n.t("overpass-presets.notenode") },
					{ key: "noteway", query: "(way[note];)", label: i18n.t("overpass-presets.noteway") },
					{ key: "construction", query: "(node[highway=construction];way[highway=construction];)", label: i18n.t("overpass-presets.construction") },
					{ key: "image", query: "(node[image];way[image];)", label: i18n.t("overpass-presets.image") },
					{ key: "camera", query: "(node['surveillance:type'~'camera|webcam'];)", label: i18n.t("overpass-presets.camera") },
				],
				[
					{ key: "city", query: "(node[place=city];)", label: i18n.t("overpass-presets.city") },
					{ key: "town", query: "(node[place=town];)", label: i18n.t("overpass-presets.town") },
					{ key: "village", query: "(node[place=village];)", label: i18n.t("overpass-presets.village") },
					{ key: "hamlet", query: "(node[place=hamlet];)", label: i18n.t("overpass-presets.hamlet") },
					{ key: "suburb", query: "(node[place=suburb];)", label: i18n.t("overpass-presets.suburb") }

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