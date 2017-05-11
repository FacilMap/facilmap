import fm from '../app';

fm.app.directive("fmSearch", function(fmSearchQuery, fmSearchFileImport) {
	return {
		restrict: "E",
		require: "^facilmap",
		scope: {},
		link: function(scope, element, attrs, map) {
			map.searchUi = fmSearchQuery(map);
			map.importUi = fmSearchFileImport(map);

			scope.$on("$destroy", () => {
				map.searchUi.destroy();
				map.importUi.destroy();

				map.searchUi = null;
				map.importUi = null;
			})
		}
	};
});