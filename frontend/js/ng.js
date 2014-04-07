(function(fp, $) {

	var facilpadApp = angular.module("facilpad", []);

	function wrapApply($scope, f) {
		return function() {
			var context = this;
			var args = arguments;
			$scope.$apply(function() {
				f.apply(context, args);
			});
		}
	}

	// From http://stackoverflow.com/a/11277751/242365
	facilpadApp.factory("socket", function($rootScope) {
		var socket = io.connect(fp.SERVER);

		var onBkp = socket.on;
		socket.on = function(eventName, fn) {
			if(fn)
				arguments[1] = wrapApply($rootScope, fn);
			onBkp.apply(this, [ eventName, fn ]);
	    };
		var emitBkp = socket.emit;
		socket.emit = function(eventName, data, cb) {
			if(cb)
				arguments[2] = wrapApply($rootScope, cb);
			emitBkp.apply(this, arguments);
		};

		return socket;
	});

	facilpadApp.directive("fpDialog", function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				$(element).dialog({autoOpen: false, modal: true});
			}
		}
	});

	facilpadApp.controller("PadCtrl", function($scope, socket) {

		$("#toolbox").menu();
		function updateMenu() {
			setTimeout(function() { $("#toolbox").menu("destroy").menu(); }, 0);
		}

		$scope.padData = null;
		$scope.loaded = false;
		$scope.markers = { };
		$scope.lines = { };
		$scope.views = { };
		$scope.dialog = null;
		$scope.dialogError = null;
		$scope.saveViewName = null;

		socket.emit("setPadId", location.href.match(/[^\/]*$/)[0]);

		bindSocketToScope($scope, socket);

		$scope.$watch("padData", function(newValue) {
			if(newValue == null || $scope.loaded)
				return;

			FacilPad.displayView(newValue.defaultView);
			$scope.loaded = true;
		});

		$scope.$watch("views", updateMenu);

		$scope.addMarker = function() {

		};

		$scope.addLine = function() {

		};

		$scope.displayView = function(view) {
			fp.displayView(view);
		};

		$scope.saveView = function() {
			var view = fp.getCurrentView();
			view.name = $scope.saveViewName;
			socket.emit("addView", view, function(err) {
				if(err)
					$scope.dialogError = err;
				else
					$scope.closeDialog();
			});
		};

		$scope.setDefaultView = function(view) {
			socket.emit("editPad", { defaultView: view.id }, function(err) {
				if(err)
					$scope.dialogError = err;
			});
		};

		$scope.deleteView = function(view) {
			socket.emit("deleteView", { id: view.id }, function(err) {
				if(err)
					$scope.dialogError = err;
			});
		};

		$scope.openDialog = function(id) {
			$scope.dialog = $("#"+id).dialog("open").bind("dialogclose", function() {
				$("#"+id+" form").each(function(){ this.reset(); });
				$scope.dialog = null;
				$scope.dialogError = null;
			});
		};

		$scope.closeDialog = function() {
			$scope.dialog.dialog("close");
		};
	});

	function bindSocketToScope($scope, socket) {
		socket.on("padData", function(data) {
			$scope.padData = data;
		});

		socket.on("marker", function(data) {
			$scope.markers[data.id] = data;
		});

		socket.on("deleteMarker", function(data) {
			delete $scope.markers[data.id];
		});

		socket.on("line", function(data) {
			$scope.lines[data.id] = data;
		});

		socket.on("deleteLine", function(data) {
			delete $scope.lines[data.id];
		});

		socket.on("view", function(data) {
			$scope.views[data.id] = data;
		});

		socket.on("deleteView", function(data) {
			delete $scope.views[data.id];
		});
	}

})(FacilPad, jQuery);