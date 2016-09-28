(function(fp, $, ng, undefined) {

	fp.app.directive("fpVariableMenuItem", function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				setTimeout(function() {
					var toolbox = $(element).closest(".fp-toolbox");
					if(toolbox.hasClass("ui-menu"))
						toolbox.menu("destroy");
					toolbox.menu();
				}, 0);
			}
		}
	});

	fp.app.factory("fpMapToolbox", function($compile, $templateCache, fpTable) {
		return function(map) {
			var scope = map.socket.$new();

			scope.addObject = function(type) {
				if(type.type == "marker")
					map.markersUi.addMarker(type);
				else if(type.type == "line")
					map.linesUi.addLine(type);
			};

			scope.displayView = map.displayView.bind(map);

			scope.saveView = map.viewsUi.saveView.bind(map.viewsUi);

			scope.manageViews = map.viewsUi.manageViews.bind(map.viewsUi);

			scope.layers = map.getLayerInfo();

			scope.setLayer = function(layer) {
				map.showLayer(layer.permalinkName, !layer.visibility);
				scope.layers = map.getLayerInfo();
			};

			scope.editPadSettings = map.padUi.editPadSettings.bind(map.padUi);

			scope.editObjectTypes = map.typesUi.editTypes.bind(map.typesUi);

			scope.showTable = fpTable.showTable.bind(fpTable);

			scope.exportGpx = map.gpxUi.exportGpx.bind(map.gpxUi);

			$compile($($templateCache.get("map-toolbox.html")).appendTo(map.map.div))(scope);
			scope.$evalAsync(); // $compile only replaces variables on next digest
		}
	});

})(FacilPad, jQuery, angular);