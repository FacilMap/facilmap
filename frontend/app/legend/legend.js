import fm from '../app';
import $ from 'jquery';

fm.app.directive("fmLegend", function($sce, fmUtils, $compile, fmIcons, fmFilter) {
	return {
		restrict: "E",
		require: "^^facilmap",
		scope: {},
		replace: true,
		template: require("./legend.html"),
		link: function(scope, element, attrs, map) {
			scope.client = map.client;

			let el = $(element);

			function update() {
				scope.legendItems = [ ];
				for(var i in scope.client.types) {
					var type = scope.client.types[i];
					var items = [ ];
					var fields = { };

					if(type.colourFixed || (type.type == "marker" && type.symbolFixed && type.defaultSymbol && (fmIcons[type.defaultSymbol] || type.defaultSymbol.length == 1)) || (type.type == "marker" && type.shapeFixed) || (type.type == "line" && type.widthFixed)) {
						var item = { value: type.name };

						if(type.colourFixed)
							item.colour = type.defaultColour;
						if(type.type == "marker" && type.symbolFixed && type.defaultSymbol && (fmIcons[type.defaultSymbol] || type.defaultSymbol.length == 1))
							item.symbol = type.defaultSymbol;
						if(type.type == "marker" && type.shapeFixed)
							item.shape = type.defaultShape;
						if(type.type == "line" && type.widthFixed)
							item.width = type.defaultWidth;

						items.push(item);
					}

					type.fields.forEach(function(field) {
						if((field.type != "dropdown" && field.type != "checkbox") || (!field.controlColour && (type.type != "marker" || !field.controlSymbol) && (type.type != "marker" || !field.controlShape) && (type.type != "line" || !field.controlWidth)))
							return;

						fields[field.name] = [ ];

						(field.options || [ ]).forEach(function(option, idx) {
							var item = { value: option.value, field: field.name, filtered: true, first: idx == 0 };

							if(field.type == "checkbox" && (!item.value || /* Legacy format */ item.value == '0' || item.value == '1')) {
								item.value = field.name;
								if(idx == 0)
									item.strikethrough = true;
							}

							if(field.controlColour)
								item.colour = option.colour;
							if(type.type == "marker" && field.controlSymbol)
								item.symbol = option.symbol;
							if(type.type == "marker" && field.controlShape)
								item.shape = option.shape;
							if(type.type == "line" && field.controlWidth)
								item.width = option.width;
							items.push(item);
							fields[field.name].push(item.value);
						});
					});

					if(items.length > 0) {
						var type = { type: type.type, typeId: type.id, name: type.name, items: items, filtered: true, defaultColour: type.defaultColour, defaultShape: type.defaultShape };

						// Check which fields are filtered
						_allCombinations(fields, function(data) {
							if(scope.client.filterFunc({ typeId: type.typeId, data: data }, true)) {
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

			scope.$watch("client.types", update, true);
			scope.client.on("filter", update);

			function getMaxScale() {
				var mapContainer = $(map.map.getContainer());
				var legendContent = el.find(".panel");
				var toolbox = $(".fm-toolbox", map.el);
				var toolboxButton = toolbox.find(".mobile-menu-button");
				var toolboxHeight = (toolbox.length > 0 ? 2 * (toolbox.offset().top - mapContainer.offset().top) + (toolboxButton.is(":visible") ? toolboxButton : toolbox).outerHeight() : 0);
				var maxHeight = mapContainer.outerHeight() - parseInt(el.css("bottom")) - toolboxHeight - el.find(".mobile-menu-button").outerHeight(true);
				var maxWidth = mapContainer.outerWidth() - parseInt(el.css("right")) * 2;

				var currentScaleMatch = legendContent.css("transform").match(/scale\((.*?)\)/);
				var currentScale = parseFloat(currentScaleMatch ? parseFloat(currentScaleMatch[1]) : 1);
				var currentHeight = legendContent.outerHeight() / currentScale;
				var currentWidth = legendContent.outerWidth() / currentScale;

				return Math.min(maxHeight / currentHeight, maxWidth / currentWidth);
			}

			var style = $("<style></style>").appendTo("head");

			function resize() {
				var maxScale = getMaxScale();
				style.text(".fm-map-legend .panel{transform:scale(" + Math.min(maxScale, 1) + ")} .fm-map-legend .panel:hover{transform:scale(" + maxScale + ")}");
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

			setTimeout(resize, 0);
			scope.$watch(getMaxScale, resize);
			scope.$watch("showXs", function(s) { s && setTimeout(resize, 0); })
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

				scope.client.setFilter(fmFilter.makeTypeFilter(scope.client.filterExpr, typeInfo.typeId, filters));
			};
		}
	};
});

fm.app.filter("fmMapLegendMakeSymbol", function(fmUtils, $sce) {
	return function(item, type) {
		var ret;

		if(type.type == "line") {
			ret = $('<span class="fm-map-legend-line"></span>');
			ret.css("background-color", "#"+(item.colour || "ffffff"));
			ret.css("box-shadow", "0 0 1px #"+fmUtils.makeTextColour(item.colour || "ffffff", 0.7));

			ret.css("height", (item.width || 5)+"px");
		}
		else
			ret = $('<img class="fm-map-legend-marker"/>').attr("src", (item.colour || item.shape) ? fmUtils.createMarkerGraphic(item.colour || type.defaultColour || "000000", 15, item.symbol, item.shape || type.defaultShape) : fmUtils.createSymbol("000000", 15, item.symbol));

		return $sce.trustAsHtml($("<div/>").append(ret).html());
	}
});
