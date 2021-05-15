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
export const overpassPresets: OverpassPresetCategory[] = [
	{
		label: "Amenities",
		presets: [
			[
				{ key: "atm", query: "(node[amenity=atm];way[amenity=atm];node[amenity=bank][atm][atm!=no];way[amenity=bank][atm][atm!=no];rel[amenity=bank][atm][atm!=no];)", label: "ATM" },
				{ key: "bank", query: "(node[amenity=bank];way[amenity=bank];rel[amenity=bank];)", label: "Bank" },
				{ key: "bench", query: "(node[amenity=bench];node(w);)", label: "Bench" },
				{ key: "bicycleparking", query: "(node[amenity=bicycle_parking];way[amenity=bicycle_parking];rel[amenity=bicycle_parking];)", label: "Bicycle parking" },
				{ key: "bicyclerental", query: "(node[amenity=bicycle_rental];way[amenity=bicycle_rental];rel[amenity=bicycle_rental];)", label: "Bicycle rental" },
				{ key: "cinema", query: "(node[amenity=cinema];way[amenity=cinema];rel[amenity=cinema];)", label: "Cinema" },
				{ key: "clinic", query: "(node[amenity=clinic];way[amenity=clinic];rel[amenity=clinic];)", label: "Clinic" },
				{ key: "drinkingwater", query: "(node[amenity=drinking_water];way[amenity=drinking_water];rel[amenity=drinking_water];)", label: "Drinking water" },
				{ key: "embassy", query: "(node[amenity=embassy];way[amenity=embassy];rel[amenity=embassy];)", label: "Embassy" },
				{ key: "firestation", query: "(node[amenity=firestation];way[amenity=firestation];rel[amenity=firestation];)", label: "Firestation" },
				{ key: "fuel", query: "(node[amenity=fuel];way[amenity=fuel];rel[amenity=fuel];)", label: "Fuel" },
				{ key: "hospital", query: "(node[amenity=hospital];way[amenity=hospital];rel[amenity=hospital];)", label: "Hospital" },
				{ key: "library", query: "(node[amenity=library];way[amenity=library];rel[amenity=library];)", label: "Library" },
				{ key: "musicschool", query: "(node[amenity=music_school];way[amenity=music_school];rel[amenity=music_school];)", label: "Music school" },
				{ key: "parking", query: "(node[amenity=parking];way[amenity=parking];rel[amenity=parking];)", label: "Parking" },
				{ key: "pharmacy", query: "(node[amenity=pharmacy];way[amenity=pharmacy];rel[amenity=pharmacy];)", label: "Pharmacy" },
				{ key: "police", query: "(node[amenity=police];way[amenity=police];rel[amenity=police];)", label: "Police" },
				{ key: "postbox", query: "(node[amenity=post_box];node(w);)", label: "Letter box" },
				{ key: "postoffice", query: "(node[amenity=post_office];way[amenity=post_office];rel[amenity=post_office];)", label: "Post office" },
				{ key: "school", query: "(node[amenity~'^school$|^college$'];way[amenity~'^school$|^college$'];rel[amenity~'^school$|^college$'];)", label: "School/college" },
				{ key: "taxi", query: "(node[amenity=taxi];way[amenity=taxi];rel[amenity=taxi];)", label: "Taxi" },
				{ key: "theatre", query: "(node[amenity=theatre];way[amenity=theatre];rel[amenity=theatre];)", label: "Theatre" },
				{ key: "toilets", query: "(node[amenity=toilets];way[amenity=toilets];rel[amenity=toilets];)", label: "Toilets" },
				{ key: "university", query: "(node[amenity=university];way[amenity=university];rel[amenity=university];)", label: "University" }
			], [
				// Check for various religions. We check on 5 religions AND also on a general place_of_worship but excluding the others.
				// zaterdag 9 januari 2016 Included rel for the stand-alone religions
				{ key: "worship", query: "(node[amenity=place_of_worship][religion!~'christian|muslim|buddhist|hindu|jewish'];way[amenity=place_of_worship][religion!~'christian|muslim|buddhist|hindu|jewish'];rel[amenity=place_of_worship][religion!~'christian|muslim|buddhist|hindu|jewish'];)", label: "Place of worship" },
				{ key: "church", query: "(node[amenity=place_of_worship][religion=christian];way[amenity=place_of_worship][religion=christian];rel[amenity=place_of_worship][religion=christian];)", label: "Church" },
				{ key: "mosque", query: "(node[amenity=place_of_worship][religion=muslim];way[amenity=place_of_worship][religion=muslim];rel[amenity=place_of_worship][religion=muslim];)", label: "Mosque" },
				{ key: "buddhist", query: "(node[amenity=place_of_worship][religion=buddhist];way[amenity=place_of_worship][religion=buddhist];rel[amenity=place_of_worship][religion=buddhist];)", label: "Buddhist Temple" },
				{ key: "hindu", query: "(node[amenity=place_of_worship][religion=hindu];way[amenity=place_of_worship][religion=hindu];rel[amenity=place_of_worship][religion=hindu];)", label: "Hindu Temple" },
				{ key: "synagogue", query: "(node[amenity=place_of_worship][religion=jewish];way[amenity=place_of_worship][religion=jewish];rel[amenity=place_of_worship][religion=jewish];)", label: "Synagogue" },
				// Check only for cemetery for human beings
				{ key: "cemetery", query: "(node[landuse=cemetery][animal!~'.'];way[landuse=cemetery][animal!~'.'];rel[landuse=cemetery][animal!~'.'];)", label: "Cemetery" }
			]
		]
	},
	{
		label: "Tourism",
		presets: [
			[
				// places to see
				{ key: "artscentre", query: "(node[amenity=arts_centre];way[amenity=arts_centre];rel[amenity=arts_centre];)", label: "Arts centre" },
				{ key: "artwork", query: "(node[tourism=artwork][artwork_type!~'statue'];way[tourism=artwork];rel[tourism=artwork];)", label: "Artwork" },
				{ key: "attraction", query: "(node[tourism=attraction];way[tourism=attraction];rel[tourism=attraction];)", label: "Attraction" },
				{ key: "casino", query: "(node[leisure=casino];way[leisure=casino];rel[leisure=casino];)", label: "Casino" },
				{ key: "castle", query: "(node[historic=castle];way[historic=castle];rel[historic=castle];)", label: "Castle" },
				{ key: "gallery", query: "(node[tourism=gallery];way[tourism=gallery];rel[tourism=gallery];)", label: "Gallery" },
				{ key: "heritage", query: "(node[heritage];way[heritage];rel[heritage];)", label: "Heritage" },
				// Check for all historic tags but exclude those that already have their own
				{ key: "historic", query: "(node[historic][historic!~'memorial|monument|statue|castle'];way[historic][historic!~'memorial|monument|statue|castle'];rel[historic][historic!~'memorial|monument|statue|castle'];)", label: "Historic" },
				{ key: "touristinformation", query: "(node[tourism=information];way[tourism=information];)", label: "Information" },
				{ key: "monument", query: "(node[historic~'^monument$|^memorial$'];way[historic~'^monument$|^memorial$'];rel[historic~'^monument$|^memorial$'];)", label: "Monument/memorial" },
				{ key: "monumentaltree", query: "(node[natural=tree][monument=yes];)", label: "Monumental Tree" },
				{ key: "museum", query: "(node[tourism=museum];way[tourism=museum];rel[tourism=museum];)", label: "Museum" },
				{ key: "picnic", query: "(node[tourism=picnic_site];way[tourism=picnic_site];rel[tourism=picnic_site];node[leisure=picnic_table];)", label: "Picnic" },
				{ key: "statue", query: "(node[historic=statue];node[landmark=statue];node[tourism=artwork][artwork_type=statue];)", label: "Statue" },
				{ key: "themepark", query: "(node[tourism=theme_park];way[tourism=theme_park];rel[tourism=theme_park];)", label: "Theme park" },
				{ key: "viewpoint", query: "(node[tourism=viewpoint];way[tourism=viewpoint];rel[tourism=viewpoint];)", label: "Viewpoint" },
				{ key: "vineyard", query: "(node[landuse=vineyard];way[landuse=vineyard];rel[landuse=vineyard];)", label: "Vineyard" },
				{ key: "windmill", query: "(node[man_made=windmill];way[man_made=windmill];rel[man_made=windmill];)", label: "Windmill" },
				{ key: "watermill", query: "(node[man_made=watermill];way[man_made=watermill];rel[man_made=watermill];)", label: "Watermill" },
				{ key: "zoo", query: "(node[tourism=zoo];way[tourism=zoo];rel[tourism=zoo];)", label: "ZOO" }
			], [
				{ key: "tourism", query: "(node[tourism=yes];way[tourism=yes];rel[tourism=yes];)", label: "Tourism=yes" }
			]
		]
	},
	{
		label: "Hotels",
		presets: [
			[
				// Places to stay
				{ key: "alpinehut", query: "(node[tourism=alpine_hut];way[tourism=alpine_hut];rel[tourism=alpine_hut];)", label: "Alpine hut" },
				{ key: "apartment", query: "(node[tourism=apartment];way[tourism=apartment];rel[tourism=apartment];)", label: "Apartment" },
				{ key: "campsite", query: "(node[tourism=camp_site][backcountry!=yes];way[tourism=camp_site][backcountry!=yes];rel[tourism=camp_site][backcountry!=yes];)", label: "Camp site" },
				{ key: "chalet", query: "(node[tourism=chalet];way[tourism=chalet];rel[tourism=chalet];)", label: "Chalet" },
				{ key: "guesthouse", query: "(node[tourism~'guest_house|bed_and_breakfast'];way[tourism~'guest_house|bed_and_breakfast'];rel[tourism~'guest_house|bed_and_breakfast'];)", label: "Guest house" },
				{ key: "hostel", query: "(node[tourism=hostel];way[tourism=hostel];rel[tourism=hostel];)", label: "Hostel" },
				{ key: "hotel", query: "(node[tourism=hotel];way[tourism=hotel];rel[tourism=hotel];)", label: "Hotel" },
				{ key: "motel", query: "(node[tourism=motel];way[tourism=motel];rel[tourism=motel];)", label: "Motel" }
			], [
				{ key: "casino", query: "(node[amenity=casino];way[amenity=casino];rel[amenity=casino];)", label: "Casino" },
				{ key: "spa", query: "(node[leisure=spa];way[leisure=spa];rel[leisure=spa];)", label: "Spa" },
				{ key: "sauna", query: "(node[leisure=sauna];way[leisure=sauna];rel[leisure=sauna];)", label: "Sauna" }
			]
		]
	},
	{
		label: "Sports",
		presets: [
			[
				{ key: "americanfootball", query: "(way[sport=american_football];way[sport=american_football];)", label: "American football" },
				{ key: "baseball", query: "(way[sport=baseball];node[sport=baseball];)", label: "Baseball" },
				{ key: "basketball", query: "(way[sport=basketball];node[sport=basketball];)", label: "Basketball" },
				{ key: "cycling", query: "(way[sport=cycling];node[sport=cycling];rel[sport=cycling];)", label: "Cycling" },
				{ key: "gymnastics", query: "(way[sport=gymnastics];node[sport=gymnastics];rel[sport=gymnastics];)", label: "Gymnastics" },
				{ key: "golfcourse", query: "(way[leisure=golf_course];way[sport=golf];node[leisure=golf_course];node[sport=golf];rel[leisure=golf_course];rel[sport=golf];)", label: "Golf" },
				{ key: "hockey", query: "(way[sport=hockey];node[sport=hockey];rel[sport=hockey];way[sport=field_hockey];node[sport=field_hockey];rel[sport=field_hockey];)", label: "Hockey" },
				{ key: "horseracing", query: "(way[sport=horse_racing];(way[sport=equestrian];node[sport=horse_racing];(node[sport=equestrian];)", label: "Horse racing" },
				{ key: "ice_hockey", query: "(way[sport=ice_hockey];node[sport=ice_hockey];rel[sport=ice_hockey];way[leisure=ice_rink]);(node[leisure=ice_rink];)", label: "Ice hockey" },
				{ key: "soccer", query: "(way[sport=soccer];node[sport=soccer];rel[sport=soccer];)", label: "Soccer" },
				{ key: "sportscentre", query: "(way[leisure=sports_centre];node[leisure=sports_centre];rel[leisure=sports_centre];)", label: "Sports centre" },
				{ key: "surfing", query: "(way[sport=surfing];node[sport=surfing];rel[sport=surfing];)", label: "Surfing" },
				{ key: "swimming", query: "(way[sport=swimming];node[sport=swimming];rel[sport=swimming];)", label: "Swimming" },
				{ key: "tennis", query: "(way[sport=tennis];node[sport=tennis];)", label: "Tennis" },
				{ key: "volleyball", query: "(way[sport=volleyball];node[sport=volleyball];)", label: "Volleyball" }
			]
		]
	},
	{
		label: "Shops",
		presets: [
			[
				//Various shops (excluding food)
				{ key: "beautyshop", query: "(node[shop=beauty];way[shop=beauty];rel[shop=beauty];)", label: "Beauty" },
				{ key: "bicycleshop", query: "(node[shop=bicycle];way[shop=bicycle];rel[shop=bicycle];)", label: "Bicycle" },
				{ key: "bookshop", query: "(node[shop~'books|stationary'];way[shop~'books|stationary'];rel[shop~'books|stationary'];)", label: "Books/Stationary" },
				{ key: "carshop", query: "(node[shop=car];way[shop=car];rel[shop=car];)", label: "Car" },
				{ key: "chemist", query: "(node[shop=chemist];way[shop=chemist];rel[shop=chemist];)", label: "Chemist" },
				{ key: "clothesshop", query: "(node[shop=clothes];way[shop=clothes];rel[shop=clothes];)", label: "Clothes" },
				{ key: "copyshop", query: "(node[shop=copyshop];way[shop=copyshop];rel[shop=copyshop];)", label: "Copyshop" },
				{ key: "cosmeticsshop", query: "(node[shop=cosmetics];way[shop=cosmetics];rel[shop=cosmetics];)", label: "Cosmetics" },
				{ key: "department_store", query: "(node[shop=department_store];way[shop=department_store];rel[shop=department_store];)", label: "Department store" },
				{ key: "diyshop", query: "(node[shop~'doityourself|hardware'];way[shop~'doityourself|hardware'];rel[shop~'doityourself|hardware'];)", label: "DIY/hardware" },
				{ key: "gardencentre", query: "(node[shop=garden_centre];way[shop=garden_centre];rel[shop=garden_centre];)", label: "Garden centre" },
				{ key: "generalshop", query: "(node[shop=general];way[shop=general];rel[shop=general];)", label: "General" },
				{ key: "giftshop", query: "(node[shop=gift];way[shop=gift];rel[shop=gift];)", label: "Gift" },
				{ key: "hairdresser", query: "(node[shop=hairdresser];way[shop=hairdresser];rel[shop=hairdresser];)", label: "Hairdresser" },
				// See tagging-list january 2016
				{ key: "jewellery_shop", query: "(node[shop~'jewelry|jewellery'];way[shop~'jewelry|jewellery'];rel[shop~'jewelry|jewellery'];)", label: "Jewelry" },
				{ key: "kiosk", query: "(node[shop=kiosk];way[shop=kiosk];rel[shop=kiosk];)", label: "Kiosk" },
				{ key: "leathershop", query: "(node[shop=leather];way[shop=leather];rel[shop=leather];)", label: "Leather" },
				{ key: "marketplace", query: "(node[amenity=marketplace];way[amenity=marketplace];rel[amenity=marketplace];)", label: "Marketplace" },
				{ key: "musicshop", query: "(node[shop=musical_instrument];way[shop=musical_instrument];rel[shop=musical_instrument];)", label: "Musical instrument" },
				{ key: "optician", query: "(node[shop=optician];way[shop=optician];rel[shop=optician];)", label: "Optician" },
				{ key: "pet_shop", query: "(node[shop=pets];way[shop=pets];rel[shop=pets];)", label: "Pets" },
				{ key: "phoneshop", query: "(node[shop=mobile_phone];way[shop=mobile_phone];rel[shop=mobile_phone];)", label: "Phone" },
				{ key: "photoshop", query: "(node[shop=photo];way[shop=photo];rel[shop=photo];)", label: "Photo" },
				{ key: "shoeshop", query: "(node[shop=shoes];way[shop=shoes];)", label: "Shoes" },
				{ key: "mall", query: "(node[shop=mall];way[shop=mall];rel[shop=mall];)", label: "Shopping centre" },
				{ key: "textileshop", query: "(node[shop=textiles];way[shop=textiles];rel[shop=textiles];)", label: "Textiles" },
				{ key: "toyshop", query: "(node[shop=toys];way[shop=toys];rel[shop=toys];)", label: "Toys" }
			]
		]
	},
	{
		label: "Food shops",
		presets: [
			[
				// food shops
				{ key: "alcoholshop", query: "(node[shop=alcohol];way[shop=alcohol];rel[shop=alcohol];)", label: "Alcohol" },
				{ key: "bakery", query: "(node[shop=bakery];way[shop=bakery];)", label: "Bakery" },
				{ key: "beverageshop", query: "(node[shop=beverages];way[shop=beverages];rel[shop=beverages];)", label: "Beverages" },
				{ key: "butcher", query: "(node[shop=butcher];way[shop=butcher];rel[shop=butcher];)", label: "Butcher" },
				{ key: "cheeseshop", query: "(node[shop=cheese];way[shop=cheese];rel[shop=cheese];)", label: "Cheese" },
				{ key: "confectionery", query: "(node[shop~'chocolate|confectionery'];way[shop~'chocolate|confectionery'];rel[shop~'chocolate|confectionery'];)", label: "Chocolate/Confectionery" },
				{ key: "coffeeshop", query: "(node[shop=coffee];way[shop=coffee];rel[shop=coffee];)", label: "Coffee" },
				{ key: "dairyshop", query: "(node[shop=dairy];way[shop=dairy];)", label: "Dairy" },
				{ key: "delishop", query: "(node[shop=deli];way[shop=deli];node[shop=delicatessen];way[shop=delicatessen];)", label: "Deli" },
				{ key: "groceryshop", query: "(node[shop=grocery];way[shop=grocery];)", label: "Grocery" },
				{ key: "organicshop", query: "(node[shop=organic];way[shop=organic];rel[shop=organic];)", label: "Organic" },
				{ key: "seafoodshop", query: "(node[shop=seafood];way[shop=seafood];rel[shop=seafood];)", label: "Seafood" },
				{ key: "supermarket", query: "(node[shop=supermarket];way[shop=supermarket];)", label: "Supermarket" },
				{ key: "wineshop", query: "(node[shop=wine];way[shop=wine];rel[shop=wine];)", label: "Wine" }
			]
		]
	},
	{
		label: "Restaurants",
		presets: [
			[
				// places to eat
				{ key: "bar", query: "(node[amenity=bar];way[amenity=bar];rel[amenity=bar];)", label: "Bar" },
				{ key: "bbq", query: "(node[amenity=bbq];way[amenity=bbq];)", label: "BBQ" },
				{ key: "biergarten", query: "(node[amenity=biergarten];way[amenity=biergarten];)", label: "Biergarten" },
				{ key: "cafe", query: "(node[amenity=cafe];way[amenity=cafe];rel[amenity=cafe];)", label: "Cafe" },
				{ key: "fastfood", query: "(node[amenity=fast_food];way[amenity=fast_food];rel[amenity=fast_food];)", label: "Fast food" },
				{ key: "foodcourt", query: "(node[amenity=food_court];way[amenity=food_court];)", label: "Food court" },
				{ key: "icecream", query: "(node[amenity=ice_cream];way[amenity=ice_cream];rel[amenity=ice_cream];node[cuisine=ice_cream];way[cuisine=ice_cream];rel[cuisine=ice_cream];)", label: "Ice cream" },
				{ key: "pub", query: "(node[amenity=pub];way[amenity=pub];rel[amenity=pub];)", label: "Pub" },
				{ key: "restaurant", query: "(node[amenity=restaurant];way[amenity=restaurant];rel[amenity=restaurant];)", label: "Restaurant" }
			]
		]
	},
	{
		label: "Various",
		presets: [
			[
				{ key: "busstop", query: "(node[highway=bus_stop];)", label: "Busstop" },
				{ key: "bicyclecharging", query: "(node[amenity=charging_station][bicycle=yes];rel[amenity=charging_station][bicycle=yes];)", label: "E-bike charging" },
				{ key: "kindergarten", query: "(node[amenity~'childcare|kindergarten'];way[amenity~'childcare|kindergarten'];rel[amenity~'childcare|kindergarten'];)", label: "Kindergarten" },
				{ key: "marketplace", query: "(node[amenity=marketplace];way[amenity=marketplace];rel[amenity=marketplace];)", label: "Marketplace" },
				{ key: "office", query: "(node[office];way[office];rel[office];)", label: "Office" },
				{ key: "recycling", query: "(node[amenity=recycling];way[amenity=recycling];rel[amenity=recycling];)", label: "Recycling" },
				{ key: "travelagency", query: "(node[shop=travel_agency];way[shop=travel_agency];rel[shop=travel_agency];)", label: "Travel agency" }
			],
			[
				{ key: "defibrillator", query: "(node[emergency=defibrillator];way[emergency=defibrillator];rel[emergency=defibrillator];)", label: "Defibrillator - AED" },
				{ key: "fireextinguisher", query: "(node[emergency=fire_extinguisher];node[emergency=fire_hose];)", label: "Fire hose/extinguisher" },
			],
			[
				// Do not include a relation for the fixme, as it produces a lot of extraneous data
				{ key: "fixme", query: "(node[fixme];way[fixme];node[FIXME];way[FIXME];)", label: "fixme" },
				//	{ key: "", query: "(node[~'^fixme$',i];way[~'^fixme$',i];)", label: "fixme" },
				{ key: "notenode", query: "(node[note];way[note];)", label: "Note-Node" },
				{ key: "noteway", query: "(way[note];)", label: "Note-Way" },
				{ key: "construction", query: "(node[highway=construction];way[highway=construction];)", label: "Construction" },
				{ key: "image", query: "(node[image];way[image];)", label: "Image" },
				{ key: "camera", query: "(node['surveillance:type'~'camera|webcam'];)", label: "Public camera" },
			],
			[
				{ key: "city", query: "(node[place=city];)", label: "City" },
				{ key: "town", query: "(node[place=town];)", label: "Town" },
				{ key: "village", query: "(node[place=village];)", label: "Village" },
				{ key: "hamlet", query: "(node[place=hamlet];)", label: "Hamlet" },
				{ key: "suburb", query: "(node[place=suburb];)", label: "Suburb" }

				//	{ key: "", query: "(way[name~'^[Ff]ietspad'];)->.fietspaden;(way(foreach.fietspaden)[highway=cycleway][name][name~'^[Ff]ietspad$'])", naam:"fietspad" }
				//	{ key: "", query: "(way[name~'^Fietspad|^fietspad|^pad$|^Pad$|cycleway|^path$|^Path$'];node(w);way[highway=cycleway][name!~'.'];node(w);)", naam:"fietspad" }
			]
		]
	}
];

export function getOverpassPreset(key: string): OverpassPreset | undefined {
	return overpassPresets.map((p) => p.presets).flat().flat().find((p) => p.key == key) as OverpassPreset | undefined;
}

export function getOverpassPresets(keys: string[]): OverpassPreset[] {
	return overpassPresets.map((p) => p.presets).flat().flat().filter((p) => keys.includes(p.key)) as OverpassPreset[];
}