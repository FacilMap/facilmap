(function(fp, $, ng, undefined) {

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

			map.mapEvents.$on("layerchange", function() {
				scope.layers = map.getLayerInfo();
			});

			scope.setLayer = function(layer) {
				map.showLayer(layer.permalinkName, !layer.visibility);
			};

			scope.editPadSettings = map.padUi.editPadSettings.bind(map.padUi);

			scope.editObjectTypes = map.typesUi.editTypes.bind(map.typesUi);

			scope.showTable = fpTable.showTable.bind(fpTable);

			scope.exportGpx = map.gpxUi.exportGpx.bind(map.gpxUi);

			scope.showAbout = function() {
				map.aboutUi.showAbout();
			};

			scope.myLocation = function() {
				map.myLocation();
			};

			var ret = {
				div: $($templateCache.get("map/toolbox/toolbox.html"))
			};
			$compile(ret.div.appendTo(map.map.getContainer()))(scope);
			scope.$evalAsync(); // $compile only replaces variables on next digest

			return ret;
		}
	});

})(FacilPad, jQuery, angular);