(function(fm, $, ng, undefined) {

	fm.app.factory("fmMapLegend", function($sce, fmUtils, $templateCache, $compile, fmIcons, fmFilter) {
		return function(map) {
			var scope = map.socket.$new();

			function update() {
				scope.legendItems = [ ];
				for(var i in scope.types) {
					var type = scope.types[i];
					var items = [ ];
					var fields = { };

					if(type.colourFixed || (type.type == "marker" && type.symbolFixed && type.defaultSymbol && fmIcons[type.defaultSymbol]) || (type.type == "line" && type.widthFixed)) {
						var item = { value: type.name };

						if(type.colourFixed)
							item.colour = type.defaultColour;
						if(type.type == "marker" && type.symbolFixed && type.defaultSymbol && fmIcons[type.defaultSymbol])
							item.symbol = type.defaultSymbol;
						if(type.type == "line" && type.widthFixed)
							item.width = type.defaultWidth;

						items.push(item);
					}

					type.fields.forEach(function(field) {
						if(!field.type == "dropdown" || (!field.controlColour && (type.type != "marker" || !field.controlSymbol) && (type.type != "line" || !field.controlWidth)))
							return;

						fields[field.name] = [ ];

						(field.options || [ ]).forEach(function(option) {
							var item = { value: option.value, field: field.name, filtered: true };
							if(field.controlColour)
								item.colour = option.colour;
							if(type.type == "marker" && field.controlSymbol)
								item.symbol = option.symbol;
							if(type.type == "line" && field.controlWidth)
								item.width = option.width;
							items.push(item);
							fields[field.name].push(item.value);
						});
					});

					if(items.length > 0) {
						var type = { type: type.type, typeId: type.id, name: type.name, items: items, filtered: true };

						// Check which fields are filtered
						_allCombinations(fields, function(data) {
							if(map.socket.filterFunc({ typeId: type.typeId, data: data }, true)) {
								type.filtered = false;

								items.forEach(function(it) {
									if(!it.field)
										it.filtered = false;
								});

								for(var i in data) {
									items.forEach(function(it) {
										if(it.field == i && it.value == data[i])
											it.filtered = false;
									});
								}
							}
						});

						scope.legendItems.push(type);
					}
				}
			}

			update();

			scope.$watch("types", update, true);
			map.socket.on("filter", update);

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

			function _allCombinations(fields, cb) {
				var fieldKeys = Object.keys(fields);

				function rec(i, vals) {
					if(i == fieldKeys.length)
						return cb(vals);

					var field = fields[fieldKeys[i]];
					for(var j=0; j<field.length; j++) {
						vals[fieldKeys[i]] = field[j];
						rec(i+1, vals);
					}
				}

				rec(0, { });
			}

			resize();
			scope.$watch(getMaxHeight, resize);
			$(window).resize(resize);

			scope.toggleFilter = function(typeInfo, item) {
				var filters = { };
				if(!item || !item.field) // We are toggling the visibility of one whole type
					filters = !typeInfo.filtered;
				else {
					typeInfo.items.forEach(function(it) {
						if(it.field) {
							if(!filters[it.field])
								filters[it.field] = { };

							if(!typeInfo.filtered || it.field == item.field)
								filters[it.field][it.value] = (it.filtered == (it != item));
							else // If the whole type is filtered, we have to enable the filters of the other fields, otherwise the type will still be completely filtered
								filters[it.field][it.value] = false;
						}
					});
				}

				map.socket.setFilter(fmFilter.makeTypeFilter(map.socket.filterExpr, typeInfo.typeId, filters));
			};
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