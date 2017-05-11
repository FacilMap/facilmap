import fm from '../app';
import packageJson from '../../package.json';

fm.app.factory("fmAbout", function($uibModal) {
	return {
		showAbout : function(map) {
			$uibModal.open({
				template: require("./about.html"),
				controller: "fmAboutCtrl",
				size: "lg",
				resolve: {
					map: () => (map)
				}
			});
		}
	};
});

fm.app.controller("fmAboutCtrl", function($scope, map) {
	$scope.layers = map ? map.getLayerInfo() : [];

	$scope.fmVersion = packageJson.version;
	$scope.fmHomepage = packageJson.homepage;
	$scope.fmBugTracker = packageJson.bugs.url;
});
