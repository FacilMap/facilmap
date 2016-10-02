(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapPopups", function($compile, $parse, $templateCache, fpUi, $timeout) {
		return function(map) {
			var openPopups = [ ];

			function _removeOpenPopup(dialog) {
				var idx = openPopups.indexOf(dialog);
				openPopups = openPopups.slice(0, idx).concat(openPopups.slice(idx+1));
			}

			return {
				open: function(template, scope, pos, onClose) {
					var dialogTemplate = $templateCache.get(template);
					if(!dialogTemplate)
						return;

					var el = $("<div/>").addClass("fp-popup fp-popup-bottom fp-popup-right").html(dialogTemplate).appendTo(map.map.div);

					var ret = {
						pos: pos,
						close: function() {
							el.remove();
							_removeOpenPopup(ret);

							$timeout(function() {
								if(onClose)
									scope.$apply(onClose);
								scope.$destroy();
							});
						},
						updatePosition: function(pos) {
							this.pos = pos;
							_updatePosition();
						},
						scope: scope,
						template: template
					};

					$('<a href="javascript:" class="close-button">×</a>').click(ret.close.bind(ret)).appendTo(el);

					$compile(el[0])(scope);
					scope.$evalAsync(); // $compile only replaces variables on next digest

					fpUi.initStyles(el);

					function _updatePosition() {
						var xy = map.posToXy(ret.pos);
						el.css({ top: xy.y + 'px', left: xy.x + 'px' });

						var vpDim = { width: $(window).width(), height: $(window).height() };

						if(el.hasClass("fp-popup-bottom") && xy.y + el.outerHeight(true) > vpDim.height)
							el.removeClass("fp-popup-bottom").addClass("fp-popup-top");
						if(el.hasClass("fp-popup-top") && xy.y + parseInt(el.css("margin-top")) < 0)
							el.removeClass("fp-popup-top").addClass("fp-popup-bottom");

						if(el.hasClass("fp-popup-left") && xy.x + parseInt(el.css("margin-left")) < 0)
							el.removeClass("fp-popup-left").addClass("fp-popup-right");
						if(el.hasClass("fp-popup-right") && xy.x + el.outerWidth(true) > vpDim.width)
							el.removeClass("fp-popup-right").addClass("fp-popup-left");
					}

					_updatePosition();
					map.mapEvents.$on("move", _updatePosition);

					openPopups.push(ret);
					return ret;
				},
				getOpenPopups : function() {
					return openPopups;
				},
				closeAll : function() {
					openPopups.forEach(function(it) {
						it.close();
					});
				}
			};
		};
	});

})(FacilPad, jQuery, angular);