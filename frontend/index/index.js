import fm from '../entry.js';
import $ from 'jquery';
import ng from 'angular';

fm.app.controller("PadCtrl", function($scope, fmMap, $timeout) {
	$scope.padId = decodeURIComponent(location.pathname.match(/[^\/]*$/)[0]);

	if(location.search && (!location.hash || location.hash == "#"))
		history.replaceState(null, "", fm.URL_PREFIX + ($scope.padId || "") + "#" + location.search.replace(/^\?/, ""));

	$timeout(function() {
		var map = fmMap.getMap("map");

		map.socket.$watch("padData.name", function(newVal) {
			$scope.padName = newVal;
		});

		map.socket.$watch("padId", function(padId) {
			if(padId)
				history.replaceState(null, "", fm.URL_PREFIX + padId + location.hash);
		});
	}, 0);

	// Dereferrer
	$(document).on("click", "a", function(e) {
		var el = $(e.target);
		var href = el.attr("href");
		if(href && href.match(/^\s*(https?:)?\/\//i)) {
			el.attr("href", "deref.html?"+encodeURIComponent(href));

			setTimeout(function() {
				el.attr("href", href);
			}, 0);
		}
	});
});

ng.bootstrap(document, [ "facilmap" ]);