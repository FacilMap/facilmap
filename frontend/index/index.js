import fm from '../entry.js';
import $ from 'jquery';
import ng from 'angular';

fm.app.controller("PadCtrl", function($scope, $timeout, $element, fmUtils) {
	$scope.padId = decodeURIComponent(location.pathname.match(/[^\/]*$/)[0]);

	let queryParams = fmUtils.decodeQueryString(location.search);
	let toBoolean = (val, def) => (val == null ? def : val != "0" && val != "false" && val != "no");
	Object.assign($scope, {
		toolbox: toBoolean(queryParams.toolbox, true),
		search: toBoolean(queryParams.search, true),
		autofocus: toBoolean(queryParams.autofocus, parent === window),
		legend: toBoolean(queryParams.legend, true)
	});

	if(!location.hash || location.hash == "#") {
		let moveKeys = Object.keys(queryParams).filter((key) => ([ "zoom", "lat", "lon", "layer", "l", "q", "s", "c" ].includes(key)));
		if(moveKeys.length > 0) {
			let hashParams = { };
			moveKeys.forEach((key) => {
				hashParams[key] = queryParams[key];
				delete queryParams[key];
			});

			let query = fmUtils.encodeQueryString(queryParams);
			let hash = fmUtils.encodeQueryString(hashParams);

			history.replaceState(null, "", fm.URL_PREFIX + ($scope.padId || "") + (query ? "?" + query : "") + "#" + hash);
		}
	}

	$timeout(function() {
		var map = angular.element($("facilmap", $element)).controller("facilmap");

		$scope.$watch(() => (map.client.padData && map.client.padData.name), function(newVal) {
			$scope.padName = newVal;
		});

		$scope.$watch(() => (map.client.padId), function(padId) {
			if(padId)
				history.replaceState(null, "", fm.URL_PREFIX + padId + location.search + location.hash);
		});
	}, 0);

	// Dereferrer
	$(document).on("click", "a", function(e) {
		var el = $(this);
		var href = el.attr("href");
		if(href && href.match(/^\s*(https?:)?\/\//i)) {
			el.attr("href", "deref.html?"+encodeURIComponent(href));

			setTimeout(function() {
				el.attr("href", href);
			}, 0);
		}
	});
});
