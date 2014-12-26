(function(fp, $, ng, undefined) {

	var openDialogs = [ ];

	function _removeOpenDialog(dialog) {
		var idx = openDialogs.indexOf(dialog);
		openDialogs = openDialogs.slice(0, idx).concat(openDialogs.slice(idx+1));
	}

	fp.app.factory("fpDialogs", [ "$compile", "$parse", "$templateCache", "fpUi", "$timeout", function($compile, $parse, $templateCache, fpUi, $timeout) {
		return {
			open: function(template, scope, title, onClose) {
				var dialogTemplate = $templateCache.get(template);
				if(!dialogTemplate)
					return;

				var el = $("<div/>").attr("title", title || "").html(dialogTemplate).appendTo("body").dialog({ modal: true, height: "auto", width: 600 });

				el.bind("dialogclose", function() {
					el.remove();
					_removeOpenDialog(ret);

					$timeout(function() {
						if(onClose)
							scope.$apply(onClose);
						scope.$destroy();
					});
				});

				$compile(el)(scope);
				scope.$evalAsync(); // $compile only replaces variables on next digest

				fpUi.initStyles(el);

				var ret = { close: function(runOnClose) {
					if(runOnClose == false)
						onClose = null;

					el.dialog("close");
				} };
				openDialogs.push(ret);
				return ret;
			},
			closeAll : function() {
				openDialogs.forEach(function(it) {
					it.close();
				});
			}
		};
	} ]);

})(FacilPad, jQuery, angular);