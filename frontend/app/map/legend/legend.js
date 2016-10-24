(function(fm, $, ng, undefined) {

	fm.app.factory("fmMapLegend", function($sce, fmUtils, $templateCache, $compile) {
		return function(map) {
			var scope = map.socket.$new();

			function update() {
				scope.legendItems = [ ];
				for(var i in scope.types) {
					var type = scope.types[i];
					var items = [ ];
					type.fields.forEach(function(field) {
						if(!field.type == "dropdown" || (!field.controlColour && (type.type != "marker" || !field.controlSymbol) && (type.type != "line" || !field.controlWidth)))
							return;

						(field.options || [ ]).forEach(function(option) {
							var item = { value: option.value };
							if(field.controlColour)
								item.colour = option.colour;
							if(type.type == "marker" && field.controlSymbol)
								item.symbol = option.symbol;
							if(type.type == "line" && field.controlWidth)
								item.width = option.width;
							items.push(item);
						});
					});

					if(items.length > 0)
						scope.legendItems.push({ type: type.type, name: type.name, items: items });
				}
			}

			update();

			scope.$watch("types", update, true);

			var el = $($templateCache.get("map/legend/legend.html")).insertAfter(map.map.getContainer());
			$compile(el)(scope);
			scope.$evalAsync(); // $compile only replaces variables on next digest

			function getMaxHeight() {
				var toolbox = map.toolboxUi.div;
				return $(map.map.getContainer()).outerHeight() - parseInt(el.css("bottom")) - 25 - toolbox.position().top - toolbox.outerHeight(true);
			}

			function resize() {
				el.css("max-height", getMaxHeight()+"px");
			}

			resize();
			scope.$watch(getMaxHeight, resize);
			$(window).resize(resize);
		};
	});

	fm.app.filter("fmMapLegendMakeSymbol", function(fmUtils, $sce) {
		return function(item, type) {
			var ret;
			if(type == "line") {
				ret = $('<span class="fm-map-legend-line"></span>');
				ret.css("background-color", "#"+(item.colour || "ffffff"));
				ret.css("box-shadow", "0 0 1px #"+fmUtils.makeTextColour(item.colour || "ffffff", 0.7));

				ret.css("height", (item.width || 5)+"px");
			}
			else
				ret = $('<img class="fm-map-legend-marker"/>').attr("src", item.colour ? fmUtils.createMarkerGraphic(item.colour, 15, item.symbol) : fmUtils.createSymbol("000000", 15, item.symbol));

			return $sce.trustAsHtml($("<div/>").append(ret).html());
		}
	});

})(FacilMap, jQuery, angular);