import { gpx, kml, tcx } from "@tmcw/togeojson";
import osmtogeojson from "osmtogeojson";
import $ from "jquery";
import { Feature, Geometry } from "geojson";
import { GeoJsonExport, LineFeature, MarkerFeature, SearchResult } from "facilmap-types";
import { flattenObject } from "facilmap-utils";

type FeatureProperties = Partial<MarkerFeature["properties"]> & Partial<LineFeature["properties"]> & {
	tags?: Record<string, string>; // Tags for OSM objects
	type?: string;
	id?: string;
}

export type FileResult = SearchResult & {
	fmTypeId?: number;
	fmProperties?: FeatureProperties;
}

export interface FileResultObject {
	features: FileResult[];
	views: GeoJsonExport["facilmap"]["views"];
	types: GeoJsonExport["facilmap"]["types"];
	errors: boolean;
}

export function parseFiles(files: string[]): FileResultObject {
	const ret: FileResultObject = { features: [ ], views: [ ], types: { }, errors: false };
	let nextTypeIdx = 1;
	for (const file of files) {
		let geojson: any;

		if(file.match(/^\s*</)) {
			const doc = $.parseXML(file);
			const xml = $(doc).find(":root");

			if(xml.is("gpx"))
				geojson = gpx(xml[0]);
			else if(xml.is("kml"))
				geojson = kml(xml[0]);
			else if(xml.is("osm"))
				geojson = osmtogeojson(doc);
			else if (xml.is("TrainingCenterDatabase"))
				geojson = tcx(xml[0]);
		} else if(file.match(/^\s*\{/)) {
			const content = JSON.parse(file);
			if(content.type)
				geojson = content;
		}

		if(geojson == null) {
			ret.errors = true;
			continue;
		}

		const typeMapping: Record<string, number> = {};

		if (geojson.facilmap) {
			if (geojson.facilmap.types) {
				for (const i of Object.keys(geojson.facilmap.types)) {
					typeMapping[i] = nextTypeIdx++;
					ret.types[typeMapping[i]] = geojson.facilmap.types[i];
				}
			}

			if(geojson.facilmap.views)
				ret.views.push(...geojson.facilmap.views);
		}

		let features: Feature<Geometry, FeatureProperties>[];
		if(geojson.type == "FeatureCollection")
			features = geojson.features || [ ];
		else if(geojson.type == "Feature")
			features = [ geojson ];
		else
			features = [ { type: "Feature", geometry: geojson, properties: { } } ];

		for (const feature of features) {
			let name;

			if(typeof feature.properties != "object")
				feature.properties = { };

			if(feature.properties.name)
				name = feature.properties.name;
			else if(feature.properties.tags && feature.properties.tags.name)
				name = feature.properties.tags.name;
			else if(feature.properties.type)
				name = feature.properties.type + " " + feature.properties.id;
			else if([ "Polygon", "MultiPolygon" ].indexOf(feature.geometry.type) != -1)
				name = "Polygon";
			else if([ "LineString", "MultiLineString" ].indexOf(feature.geometry.type) != -1)
				name = "Line";
			else if([ "Point", "MultiPoint" ].indexOf(feature.geometry.type) != -1)
				name = "Point";
			else
				name = feature.geometry.type || "Object";

			let f: FileResult = {
				short_name: name,
				display_name: name,
				extratags: feature.properties.data || feature.properties.tags || flattenObject(Object.assign({}, feature.properties, {coordTimes: null})),
				geojson: feature.geometry,
				type: feature.properties.type || feature.geometry.type
			};

			if(geojson.facilmap) {
				if(feature.properties.typeId && typeMapping[feature.properties.typeId])
					f.fmTypeId = typeMapping[feature.properties.typeId];
				f.fmProperties = feature.properties;
			}

			ret.features.push(f);
		}
	}

	// if(errors)
	//	return map.messages.showMessage("danger", "Some files could not be parsed.");

	return ret;
}