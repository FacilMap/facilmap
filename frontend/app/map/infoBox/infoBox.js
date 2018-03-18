import ng from 'angular';

import fm from '../../app';
import css from './infoBox.scss';

fm.app.factory("fmInfoBox", function($rootScope, $compile, $timeout, fmUtils) {
	return function(map) {
		let scope = $rootScope.$new();
		scope.className = css.className;

		let currentObj = null;

		let el = $(require("./infoBox.html"));

		$timeout(() => {
			el.insertAfter(map.map.getContainer()).hide();
			$compile(el)(scope);

			el.resizable({
				handles: {
					nw: el.find(".ui-resizable-handle")
				},
				minHeight: 100,
				minWidth: 250,
				stop: () => {
					el.find(".html").children().trigger("resizeend");
				}
			});
		});

		let getLegendSize = () => {
			let legendEl = map.el.find(".fm-map-legend");
			let legendPanelEl = legendEl.find("> .panel");

			if(legendEl.length > 0 && !legendPanelEl.hasClass("ng-hide"))
				return legendPanelEl[0].getBoundingClientRect();
		};

		let infoBox = {
			show({template, scope, onCloseStart, onCloseEnd, id, center, zoom}) {
				if(currentObj) {
					currentObj.onCloseStart && currentObj.onCloseStart();
					currentObj.onCloseEnd && currentObj.onCloseEnd();
				}

				let htmlEl = $(".html", el).empty().append(template);
				if(scope !== false)
					$compile(htmlEl)(scope);

				if(!el.is(":visible")) {
					let legendSize = getLegendSize();

					if(legendSize) {
						el.show();

						el.css({ transform: "", "transition": "all 0s ease 0s" });
						el.css("transform", `scale(${legendSize.width/el.width()}, ${legendSize.height/el.height()})`);

						setTimeout(() => { // We have to run this after the transform applies
							map.el.find(".fm-map-legend").addClass("fm-infoBox-hidden");
							el.css("transition", "");
							el.css("transform", ""); // Gets animated by CSS transition
						}, 0);
					} else {
						el.css("transition", "all 0s ease 0s");
						el.fadeIn(700, () => {
							el.css("transition", "");
						});
					}
				} else if (!currentObj) {
					// Element is still visible, but currentObj is null: A hide animation is in progress

					if(getLegendSize()) {
						el.show();
						map.el.find(".fm-map-legend").addClass("fm-infoBox-hidden");
						el.css("transition", "");
						el.css("transform", ""); // Gets animated by CSS transition
					} else {
						el.css("transition", "all 0s ease 0s");
						el.fadeIn(700, () => {
							el.css("transition", "");
						});
					}
				}

				let thisCurrentObj = currentObj = {
					onCloseStart,
					onCloseEnd,
					id,
					center,
					zoom
				};

				infoBox.currentId = id;

				map.mapEvents.$broadcast("searchchange");

				return {
					hide: () => {
						if(currentObj !== thisCurrentObj)
							return;

						infoBox.hide();
					}
				};
			},

			async hide() {
				if(!currentObj)
					return;

				let obj = currentObj;
				currentObj = null;
				infoBox.currentId = null;

				map.mapEvents.$broadcast("searchchange");

				obj.onCloseStart && obj.onCloseStart();

				await new Promise((resolve) => {
					let legendSize = getLegendSize();

					if(legendSize) {
						el.css("transform", `scale(${legendSize.width/el.width()}, ${legendSize.height/el.height()})`).one("transitionend", () => {
							if(!currentObj) { // Something new might have opened in the meantime
								el.css("transform", "").hide();
								el.hide();
								map.el.find(".fm-map-legend").removeClass("fm-infoBox-hidden");
							}
							resolve();
						});
					} else {
						el.css("transition", "all 0s ease 0s");
						el.fadeOut(700, () => {
							if(!currentObj) { // Something new might have opened in the meantime
								el.css("transition", "");
								map.el.find(".fm-map-legend").removeClass("fm-infoBox-hidden");
							}
							resolve();
						});
					}
				});

				obj.onCloseEnd && obj.onCloseEnd();
			},

			isCurrentObjectZoomed() {
				if(!currentObj || currentObj.zoom == null || currentObj.center == null)
					return null;

				return map.map.getZoom() == currentObj.zoom && fmUtils.pointsEqual(map.map.getCenter(), currentObj.center, map.map);
			}
		};

		scope.hide = infoBox.hide;

		return infoBox;
	};
});

fm.app.directive("fmInfoBoxBind", function($compile) {
	return {
		restrict: 'A',
		scope: {
			layer: "<fmInfoBoxBind"
		},
		link: function(scope, element, attrs) {
			scope.$watchGroup(["layer.html", "layer.scope"], () => {
				let el = $(scope.layer.html);
				element.empty().append(el);

				if(scope.layer.scope !== false)
					$compile(el)(scope.layer.scope);
			});
		}
	};
});
