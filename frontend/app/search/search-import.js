import fm from '../app';

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
