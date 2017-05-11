import ng from 'angular';

import fm from '../../app';
import css from './infoBox.scss';

fm.app.factory("fmInfoBox", function($rootScope, $compile, $timeout) {
	return function(map) {
		let scope = $rootScope.$new();
		scope.className = css.className;
		scope.layers = [];

		let el = $(require("./infoBox.html"));

		$timeout(() => {
			el.insertAfter(map.map.getContainer()).hide();
			$compile(el)(scope);
		});

		let show = () => {
			return new Promise((resolve) => {
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
						el.one("transitionend", resolve);
					}, 0);
				} else {
					el.css("transition", "all 0s ease 0s");
					el.fadeIn(700, () => {
						el.css("transition", "");
						resolve();
					});
				}
			});
		};

		let hide = () => {
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
			});
		};

		let infoBox = {
			show(html, htmlScope, clearOpenLayers, onClose) {
				let obj = {
					html,
					onClose,
					scope: htmlScope || $rootScope,
					hide() {
						let newLayers = scope.layers.filter((it) => (!ng.equals(it, obj))); // Can't use !== because ng-repeat adds $$hashKey
						onClose && onClose();
						Promise.resolve().then(() => {
							if(newLayers.length == 0)
								return hide();
						}).then(() => {
							scope.layers = newLayers;
						});
					}
				};

				if(scope.layers.length == 0)
					scope.$evalAsync(() => { $timeout(show); });

				if(clearOpenLayers) {
					scope.layers.forEach((layer) => {
						layer.onClose && layer.onClose();
					});
					scope.layers = [];
				}

				scope.layers.push(obj);

				return obj;
			},
			hideAll() {
				return hide().then(() => {
					scope.layers.forEach((layer) => {
						layer.onClose && layer.onClose();
					});

					scope.layers = [ ];
				});
			}
		};

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
				$compile(el)(scope.layer.scope);
			});
		}
	};
});
