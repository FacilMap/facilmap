import fm from '../app';
import $ from 'jquery';

fm.app.directive("fmToolbox", function($compile, fmFilter, fmAbout) {
	return {
		restrict: "E",
		require: "^facilmap",
		template: require("./toolbox.html"),
		replace: true,
		scope: {
			interactive: "<interactive"
		},
		link: function(scope, element, attrs, map) {
			if(scope.interactive == null)
				scope.interactive = true;

			scope.client = map.client;

			scope.links = {};
			function updateLinks() {
				if(!map.map._loaded)
					return;

				let center = map.map.getCenter();
				let zoom = map.map.getZoom();

				scope.links.osm = `https://www.openstreetmap.org/#map=${zoom}/${center.lat}/${center.lng}`;
				scope.links.google = `https://www.google.com/maps/@${center.lat},${center.lng},${zoom}z`;
				scope.links.bing = `https://www.bing.com/maps?cp=${center.lat}~${center.lng}&lvl=${zoom}`;

				scope.$evalAsync(() => { // Make sure that location hash is updated after the event
					scope.links.facilmap = `/${location.hash && location.hash != "#" ? location.hash : `#${zoom}/${center.lat}/${center.lng}`}`;
				});
			}
			updateLinks();
			map.map.on("moveend", updateLinks);
			map.mapEvents.$on("searchchange", updateLinks);

			scope.$watch("client.filterExpr", (filterExpr) => {
				if(filterExpr) {
					scope.filterQueryQ = `?filter=${encodeURIComponent(filterExpr)}`;
					scope.filterQueryA = `&filter=${encodeURIComponent(filterExpr)}`;
				} else {
					scope.filterQueryQ = scope.filterQueryA = "";
				}
			});

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

			scope.$watch(() => !!map.importUi, (hasImportUi) => {
				scope.hasImportUi = hasImportUi;
			});

			scope.importFile = function() {
				map.importUi.openImportDialog();
			};

			scope.showAbout = function() {
				fmAbout.showAbout(map);
			};

			scope.startPad = function() {
				map.padUi.createPad();
			};

			scope.filter = function() {
				fmFilter.showFilterDialog(map.client.filterExpr, map.client.types).then(function(newFilter) {
					map.client.setFilter(newFilter);
				});
			};

			scope.showHistory = function() {
				map.historyUi.openHistoryDialog();
			};
		}
	};
});
