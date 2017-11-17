import fm from '../app';

fm.app.directive("fmSearch", function(fmSearchQuery, fmSearchFileImport) {
	return {
		restrict: "E",
		require: "^facilmap",
		scope: {
			autofocus: "<autofocus"
		},
		link: function(scope, element, attrs, map) {
			let autofocus = scope.autofocus;
			if(autofocus == null)
				autofocus = (window === parent);

			map.searchUi = fmSearchQuery(map, autofocus);
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