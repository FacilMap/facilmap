import fm from '../../app';
import packageJson from '../../../package.json';

fm.app.factory("fmMapAbout", function($uibModal) {
	return function(map) {
		return {
			showAbout : function() {
				$uibModal.open({
					template: require("./about.html"),
					scope: map.socket,
					controller: "fmMapAboutCtrl",
					size: "lg",
					resolve: {
						map: function() { return map; }
					}
				});
			}
		};
	};
});

fm.app.controller("fmMapAboutCtrl", function($scope, map) {
	$scope.layers = map.getLayerInfo();

	$scope.fmVersion = packageJson.version;
	$scope.fmHomepage = packageJson.homepage;
	$scope.fmBugTracker = packageJson.bugs.url;
});
