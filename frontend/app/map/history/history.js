(function(fm, $, ng, undefined) {

	fm.app.factory("fmMapHistory", function($uibModal, fmUtils) {
		return function(map) {
			var fmMapHistory = {
				openHistoryDialog: function() {
					var scope = map.socket.$new();

					var dialog = $uibModal.open({
						templateUrl: "map/history/history.html",
						scope: scope,
						controller: "fmMapHistoryDialogCtrl",
						size: "lg",
						resolve: {
							map: function() { return map; }
						}
					});

					map.socket.listenToHistory().catch(function(err) {
						scope.error = err;
					});

					var unsubscribe = map.socket.stopListeningToHistory.bind(map.socket);
					dialog.result.then(unsubscribe, unsubscribe);

					scope.$watch("history", function() {
						for(var i in scope.history) {
							scope.history[i].labels = fmMapHistory._getLabelsForItem(scope.history[i]);
						}
					}, true);
				},

				_existsNow: function(item) {
					// Look through the history of this particular object and see if the last entry indicates that the object exists now

					var ret = null;
					var time = 0;
					for(var i in map.socket.history) {
						var item2 = map.socket.history[i];

						var time2 = new Date(item2.time).getTime();
						if(item2.type == item.type && item2.objectId == item.objectId && time2 > time) {
							ret = (item2.action != "delete");
							time = time2;
						}
					}

					return ret;
				},

				_getLabelsForItem: function(item) {
					if(item.type == "Pad") {
						return {
							description: "Changed pad settings",
							button: "Revert",
							confirm: "Do you really want to restore the old version of the pad settings?"
						};
					}

					var nameStrBefore = item.objectBefore && item.objectBefore.name ? "“" + item.objectBefore.name + "”" : "";
					var nameStrAfter = item.objectAfter && item.objectAfter.name ? "“" + item.objectAfter.name + "”" : "";

					var existsNow = fmMapHistory._existsNow(item);

					var ret = {
						description: {
							create: "Created",
							update: "Changed",
							delete: "Deleted"
						}[item.action] + " " + item.type + " " + item.objectId + " " + (nameStrBefore && nameStrAfter && nameStrBefore != nameStrAfter ? nameStrBefore + " (new name: " + nameStrAfter + ")" : (nameStrBefore || nameStrAfter)),
					};

					if(item.action == "create") {
						if(existsNow) {
							ret.button = "Revert (delete)";
							ret.confirm = "delete";
						}
					} else if(existsNow) {
							ret.button = "Revert";
							ret.confirm = "restore the old version of";
					} else {
						ret.button = "Restore";
						ret.confirm = "restore";
					}

					if(ret.confirm)
						ret.confirm = "Do you really want to " + ret.confirm + " " + ((nameStrBefore || nameStrAfter) ? "the " + item.type + " " + (nameStrBefore || nameStrAfter) : "this " + item.type);

					if(item.objectBefore && item.objectAfter)
						ret.diff = fmUtils.getObjectDiff(item.objectBefore, item.objectAfter);

					return ret;
				}
			};

			return fmMapHistory;
		};
	});

	fm.app.controller("fmMapHistoryDialogCtrl", function($scope, map) {
		$scope.revert = function(item) {
			$scope.error = null;
			map.socket.revertHistoryEntry({ id: item.id }).catch(function(err) {
				$scope.error = err;
			});
		};
	});

})(FacilMap, jQuery, angular);