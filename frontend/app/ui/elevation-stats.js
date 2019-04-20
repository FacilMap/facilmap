import fm from "../app";

fm.app.directive("fmElevationStats", function() {
	return {
		restrict: "E",
		scope: {
			route: "<",
			stats: "<"
		},
		template: require("./elevation-stats.html"),
		link: (scope) => {
			scope.$watch("stats", (stats) => {
				scope.statsArr = stats && Object.keys(stats).map((i) => (Object.assign({ i: parseInt(i), distance: stats[i] })));
			}, true);
		}
	};
});