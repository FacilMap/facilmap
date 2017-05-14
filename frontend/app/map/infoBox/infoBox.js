import ng from 'angular';

import fm from '../../app';
import css from './infoBox.scss';

fm.app.factory("fmInfoBox", function($rootScope, $compile, $timeout) {
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

		let infoBox = {
			show(html, htmlScope, onClose) {
				if(currentObj)
					currentObj.onClose && currentObj.onClose();

				let htmlEl = $(".html", el).empty().append(html);
				if(htmlScope !== false)
					$compile(htmlEl)(htmlScope);

				if(!currentObj) {
					let legendEl = map.el.find(".fm-map-legend");
					let legendPanelEl = legendEl.find("> .panel");

					if(legendEl.length > 0 && !legendPanelEl.hasClass("ng-hide")) {
						let legendSize = legendPanelEl[0].getBoundingClientRect();

						el.show();

						el.css({ transform: "", "transition": "all 0s ease 0s" });
						el.css("transform", `scale(${legendSize.width/el.width()}, ${legendSize.height/el.height()})`);

						setTimeout(() => { // We have to run this after the transform applies
							legendEl.addClass("fm-infoBox-hidden");
							el.css("transition", "");
							el.css("transform", ""); // Gets animated by CSS transition
						}, 0);
					} else {
						el.css("transition", "all 0s ease 0s");
						el.fadeIn(700, () => {
							el.css("transition", "");
						});
					}
				}

				let thisCurrentObj = currentObj = {
					onClose
				};

				return {
					hide: () => {
						if(currentObj !== thisCurrentObj)
							return;

						infoBox.hide();
					}
				};
			},
			hide() {
				if(!currentObj)
					return Promise.resolve();

				return new Promise((resolve) => {
					let legendEl = map.el.find(".fm-map-legend");
					let legendPanelEl = legendEl.find("> .panel");

					if(legendEl.length > 0 && !legendPanelEl.hasClass("ng-hide")) {
						let legendSize = legendPanelEl[0].getBoundingClientRect();

						el.css("transform", `scale(${legendSize.width/el.width()}, ${legendSize.height/el.height()})`).one("transitionend", () => {
							el.css("transform", "").hide();
							el.hide();
							legendEl.removeClass("fm-infoBox-hidden");
							resolve();
						});
					} else {
						el.css("transition", "all 0s ease 0s");
						el.fadeOut(700, () => {
							el.css("transition", "");
							resolve();
						});
					}
				}).then(() => {
					currentObj.onClose && currentObj.onClose();
					currentObj = null;
				});
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
