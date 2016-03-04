(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapViews", function(fpDialogs) {
		return function(map) {
			var ret = {
				saveView : function() {
					var scope = map.socket.$new();
					scope.name = null;

					scope.save = function(makeDefault) {
						var view = map.getCurrentView();
						view.name = scope.name;
						map.socket.emit("addView", view, function(err, view) {
							if(err)
								return scope.error = err;

							if(makeDefault) {
								map.socket.emit("editPad", { defaultViewId: view.id }, function(err) {
									if(err)
										return scope.error = err;

									scope.dialog.close();
								});
							}
							else
								scope.dialog.close();
						});
					};

					scope.dialog = fpDialogs.open("save-view.html", scope, "Save current view");
				},
				manageViews : function() {
					var scope = map.socket.$new();

					scope.display = function(view) {

					};

					scope.makeDefault = function(view) {
						map.socket.emit("editPad", { defaultViewId: view.id }, function(err) {
							if(err)
								scope.error = err;
						});
					};

					scope['delete'] = function(view) {
						map.socket.emit("deleteView", { id: view.id }, function(err) {
							if(err)
								scope.error = err;
						});
					};

					scope.dialog = fpDialogs.open("manage-views.html", scope, "Manage views");
				}
			};

			return ret;
		};
	});

})(FacilPad, jQuery, angular);