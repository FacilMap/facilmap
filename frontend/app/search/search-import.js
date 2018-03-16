import fm from '../app';

function _lineStringToTrackPoints(geometry) {
	var ret = [ ];
	var coords = (["MultiPolygon", "MultiLineString"].indexOf(geometry.type) != -1 ? geometry.coordinates : [ geometry.coordinates ]);

	// Take only outer ring of polygons
	if(["MultiPolygon", "Polygon"].indexOf(geometry.type) != -1)
		coords = coords.map((coordArr) => coordArr[0]);

	coords.forEach(function(linePart) {
		linePart.forEach(function(latlng) {
			ret.push({ lat: latlng[1], lon: latlng[0] });
		});
	});
	return ret;
}

fm.app.factory("fmSearchImport", function($uibModal, $rootScope) {
	return function(map) {
		let importUi = {
			openImportDialog(results) {
				let scope = $rootScope.$new();

				let dialog = $uibModal.open({
					template: require("./custom-import.html"),
					scope: scope,
					controller: "fmSearchCustomImportController",
					size: "lg",
					resolve: {
						map: function() { return map; },
						results: function() { return results; },
						importUi: function() { return importUi; }
					}
				});
			},

			addResultToMap(result, type, showEdit) {
				let obj = {
					name: result.short_name
				};

				if(result.fmProperties) { // Import GeoJSON
					Object.assign(obj, result.fmProperties);
					delete obj.typeId;
				} else {
					obj.data = importUi._mapSearchResultToType(result, type)
				}

				if(type.type == "marker") {
					return map.markersUi.createMarker(result.lat != null && result.lon != null ? result : { lat: result.geojson.coordinates[1], lon: result.geojson.coordinates[0] }, type, obj, !showEdit);
				} else if(type.type == "line") {
					if(!result.fmProperties || !result.fmProperties.routePoints) {
						var trackPoints = _lineStringToTrackPoints(result.geojson);
						$.extend(obj, { trackPoints: trackPoints, mode: "track" });
						return map.linesUi.createLine(type, [ trackPoints[0], trackPoints[trackPoints.length-1] ], obj, !showEdit);
					} else {
						return map.linesUi.createLine(type, obj.routePoints, obj, !showEdit);
					}
				}
			},

			/**
			 * Prefills the fields of a type with information from a search result. The "address" and "extratags" from
			 * the search result are taken matched whose names equal the tag key (ignoring case and non-letters). The
			 * returned object is an object that can be used as "data" for a marker and line, so an object that maps
			 * field names to values.
			 */
			_mapSearchResultToType(result, type) {
				let keyMap = (keys) => {
					let ret = {};
					for(let key of keys)
						ret[key.replace(/[^a-z0-9]/gi, "").toLowerCase()] = key;
					return ret;
				};

				let resultData = Object.assign({
					address: result.address
				}, result.extratags);

				let fieldKeys = keyMap(type.fields.map((field) => (field.name)));
				let resultDataKeys = keyMap(Object.keys(resultData));

				let ret = {};
				for(let key in resultDataKeys) {
					if(fieldKeys[key])
						ret[fieldKeys[key]] = resultData[resultDataKeys[key]];
				}
				return ret;
			}
		};

		return importUi;
	}
});

fm.app.controller("fmSearchCustomImportController", function(map, results, $scope, $q, importUi) {
	$scope.results = results;
	$scope.client = map.client;

	$scope.importTypeCounts = {};
	$scope.untypedMarkers = 0;
	$scope.untypedLines = 0;
	for(let feature of results.features) {
		if(feature.fmTypeId == null) {
			if(feature.isMarker)
				$scope.untypedMarkers++;
			if(feature.isLine)
				$scope.untypedLines++;
		} else if($scope.importTypeCounts[feature.fmTypeId] == null)
			$scope.importTypeCounts[feature.fmTypeId] = 1;
		else
			$scope.importTypeCounts[feature.fmTypeId]++;
	}

	$scope.mapping = {};
	for(let importTypeId in results.types) {
		for(let typeId in map.client.types) {
			if(results.types[importTypeId].name == map.client.types[typeId].name) {
				$scope.mapping[importTypeId] = `e${typeId}`;
				break;
			}
		}

		if(!$scope.mapping[importTypeId])
			$scope.mapping[importTypeId] = `i${importTypeId}`;
	}

	$scope.mapUntypedMarkers = false;
	$scope.mapUntypedLines = false;


	$scope.save = function() {
		$scope.error = null;

		let resolvedMapping = {};
		let resolvedUntypedMarkerMapping;
		let resolvedUntypedLineMapping;
		let createTypes = {};
		for(let mapping in $scope.mapping) {
			if(!$scope.mapping[mapping])
				continue;

			let m = $scope.mapping[mapping].match(/^([ei])(.*)$/);
			if(m[1] == "e")
				resolvedMapping[mapping] = m[2];
			else if(!createTypes[m[2]]) {
				createTypes[m[2]] = map.client.addType(results.types[m[2]]).then((newType) => {
					resolvedMapping[mapping] = newType.id;
				});
			}
		}

		if($scope.mapUntypedMarkers) {
			let m = $scope.mapUntypedMarkers.match(/^([ei])(.*)$/);
			if(m[1] == "e")
				resolvedUntypedMarkerMapping = m[2];
			else if(!createTypes[m[2]]) {
				createTypes[m[2]] = map.client.addType(results.types[m[2]]).then((newType) => {
					resolvedUntypedMarkerMapping = newType.id;
				});
			}
		}

		if($scope.mapUntypedLines) {
			let m = $scope.mapUntypedLines.match(/^([ei])(.*)$/);
			if(m[1] == "e")
				resolvedUntypedLineMapping = m[2];
			else if(!createTypes[m[2]]) {
				createTypes[m[2]] = map.client.addType(results.types[m[2]]).then((newType) => {
					resolvedUntypedLineMapping = newType.id;
				});
			}
		}

		$q.all(createTypes).then(() => {
			let createObjects = [];
			for(let feature of results.features) {
				if(feature.fmTypeId == null) {
					if(feature.isMarker && resolvedUntypedMarkerMapping)
						createObjects.push(importUi.addResultToMap(feature, map.client.types[resolvedUntypedMarkerMapping]));
					if(feature.isLine && resolvedUntypedLineMapping)
						createObjects.push(importUi.addResultToMap(feature, map.client.types[resolvedUntypedLineMapping]));
				} else if(resolvedMapping[feature.fmTypeId])
					createObjects.push(importUi.addResultToMap(feature, map.client.types[resolvedMapping[feature.fmTypeId]]));
			}

			return $q.all(createObjects);
		}).then(() => {
			$scope.$close();
		}).catch((err) => {
			$scope.error = err;
		});
	};
});
