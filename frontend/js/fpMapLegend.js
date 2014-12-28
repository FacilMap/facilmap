(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapLegend", [ "$sce", "fpUtils", "$templateCache", "$compile", function($sce, fpUtils, $templateCache, $compile) {
		return function(map) {
			var scope = map.socket.$new();

			scope.makeSymbol = function(type, item) {
				var ret;
				if(type == "line") {
					ret = $('<span class="fp-map-legend-line"></span>');
					ret.css("background-color", "#"+(item.colour || "ffffff"));
					ret.css("box-shadow", "0 0 1px #"+fpUtils.makeTextColour(item.colour || "ffffff", 0.7));

					ret.css("height", (item.width || 5)+"px");
				}
				else
					ret = $('<img class="fp-map-legend-marker"/>').attr("src", fpUtils.createMarkerGraphic(item.colour, "legend"));

				return $sce.trustAsHtml($("<div/>").append(ret).html());
			};

			function update() {
				scope.legendItems = [ ];
				for(var i in scope.types) {
					var type = scope.types[i];
					var items = [ ];
					type.fields.forEach(function(field) {
						if(!field.type == "dropdown" || (!field.controlColour && (type.type != "line" || !field.controlWidth)))
							return;

						(field.options || [ ]).forEach(function(option) {
							var item = { value: option.value };
							if(field.controlColour)
								item.colour = option.colour;
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

			var el = $($templateCache.get("map-legend.html")).appendTo(map.map.div)
			$compile(el)(scope);
			scope.$evalAsync(); // $compile only replaces variables on next digest

			function getMaxHeight() {
				var toolbox = $(".fp-toolbox", map.map.div);
				return $(map.map.div).outerHeight() - parseInt(el.css("bottom")) - 25 - toolbox.position().top - toolbox.outerHeight(true);
			}

			function resize() {
				el.css("max-height", getMaxHeight()+"px");
			}

			resize();
			scope.$watch(getMaxHeight, resize);
			$(window).resize(resize);
		};
	} ]);

})(FacilPad, jQuery, angular);