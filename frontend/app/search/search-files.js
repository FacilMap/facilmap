import toGeoJSON from '@mapbox/togeojson';
import osmtogeojson from 'osmtogeojson';

import fm from '../app';


fm.app.factory("fmSearchFiles", function($rootScope, $compile, fmUtils) {
	return function(map, searchUi) {
		const fmMapSearchFiles = {
			parseFiles(files) {
				var ret = {features: [ ], views: [ ], types: { }};
				var errors = false;
				var nextTypeIdx = 1;
				files.forEach(function(file) {
					var geojson = null;

					if(file.match(/^\s*</)) {
						var doc = $.parseXML(file);
						var xml = $(doc).find(":root");

						if(xml.is("gpx"))
							geojson = toGeoJSON.gpx(xml[0]);
						else if(xml.is("kml"))
							geojson = toGeoJSON.kml(xml[0]);
						else if(xml.is("osm"))
							geojson = osmtogeojson(doc);
					} else if(file.match(/^\s*\{/)) {
						var content = JSON.parse(file);
						if(content.type)
							geojson = content;
					}

					if(geojson == null)
						return errors = true;

					var typeMapping = {};

					if(geojson.facilmap) {
						if(geojson.facilmap.types) {
							for(let i in geojson.facilmap.types) {
								typeMapping[i] = nextTypeIdx++;
								ret.types[typeMapping[i]] = geojson.facilmap.types[i];
							}
						}

						if(geojson.facilmap.views)
							ret.views.push(...geojson.facilmap.views);
					}

					var features;
					if(geojson.type == "FeatureCollection")
						features = geojson.features || [ ];
					else if(geojson.type == "Feature")
						features = [ geojson ];
					else
						features = [ { type: "Feature", geometry: geojson, properties: { } } ];

					features.forEach(function(feature) {
						var name;

						if(typeof feature.properties != "object")
							feature.properties = { };

						if(feature.properties.name)
							name = feature.properties.name;
						else if(feature.properties.tags.name)
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

						let f = {
							short_name: name,
							display_name: name,
							extratags: feature.properties.data || feature.properties.tags || fmUtils.flattenObject(Object.assign({}, feature.properties, {coordTimes: null})),
							geojson: feature.geometry,
							type: feature.properties.type || feature.geometry.type
						};

						if(geojson.facilmap) {
							if(feature.properties.typeId && typeMapping[feature.properties.typeId])
								f.fmTypeId = typeMapping[feature.properties.typeId];
							f.fmProperties = feature.properties;
						}

						ret.features.push(f);
					});
				});

				if(errors)
					return map.messages.showMessage("danger", "Some files could not be parsed.");

				return ret;
			}
		};

		return fmMapSearchFiles;
	};
});