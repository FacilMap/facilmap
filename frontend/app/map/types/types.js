(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapTypes", function($uibModal, fpUtils) {
		return function(map) {
			var ret = {
				editTypes : function() {
					$uibModal.open({
						templateUrl: "map/types/edit-types.html",
						scope: map.socket,
						controller: "fpMapTypesEditCtrl",
						size: "lg",
						resolve: {
							map: function() { return map; }
						}
					});
				},
				editType : function(type) {
					var scope = map.socket.$new();
					scope.type = type;

					var dialog = $uibModal.open({
						templateUrl: "map/types/edit-type.html",
						scope: scope,
						controller: "fpMapTypesEditTypeCtrl",
						size: "lg",
						resolve: {
							map: function() { return map; }
						}
					});

					var preserve = fpUtils.preserveObject(map.socket, type.id ? "types["+fpUtils.quoteJavaScript(type.id)+"]" : "type", "type", function() {
						dialog.dismiss();
					});

					dialog.result.then(preserve.leave.bind(preserve), preserve.revert.bind(preserve));
				},
				editTypeDropdown : function(type, field) {
					var scope = map.socket.$new();
					scope.type = type;
					scope.field = field;

					var dialog = $uibModal.open({
						templateUrl: "map/types/edit-type-dropdown.html",
						scope: scope,
						controller: "fpMapTypesEditTypeDropdownCtrl",
						size: "lg",
						resolve: {
							map: function() { return map; }
						}
					});

					var preserve = fpUtils.preserveObject(scope, "field", "field", function() {
						dialog.dismiss();
					});

					dialog.result.then(preserve.leave.bind(preserve), preserve.revert.bind(preserve));
				},
				canControl : function(type, what, ignoreField) {
					var idx = "control"+what.charAt(0).toUpperCase() + what.slice(1);
					for(var i=0; i<(type && type.fields && type.fields || [ ]).length; i++) {
						if(type.fields[i][idx] && (!ignoreField || type.fields[i] !== ignoreField))
							return false;
					}
					return true;
				}
			};
			return ret;
		};
	});

	fp.app.controller('fpMapTypesEditCtrl', function($scope, map) {
		$scope.create = function() {
			$scope.edit({
				fields : [ ]
			});
		};

		$scope.edit = map.typesUi.editType.bind(map.typesUi);

		$scope['delete'] = function(type) {
			$scope.error = null;
			map.socket.emit("deleteType", { id: type.id }, function(err) {
				if(err)
					$scope.error = err;
			});
		};
	});

	fp.app.controller('fpMapTypesEditTypeCtrl', function($scope, map) {
		$scope.editDropdown = function(field) {
			map.typesUi.editTypeDropdown($scope.type, field);
		};

		$scope.createField = function() {
			$scope.type.fields.push({ name: "", type: "input", "default": "" });
		};

		$scope.deleteField = function(field) {
			var idx = $scope.type.fields.indexOf(field);
			if(idx != -1)
				$scope.type.fields = $scope.type.fields.slice(0, idx).concat($scope.type.fields.slice(idx+1));
		};

		$scope.save = function() {
			$scope.error = null;
			map.socket.emit($scope.type.id == null ? "addType" : "editType", $scope.type, function(err) {
				if(err)
					return $scope.error = err;

				$scope.$close();
			});
		};
	});

	fp.app.controller('fpMapTypesEditTypeDropdownCtrl', function($scope, map, fpUtils) {
		$scope.canControl = function(what) {
			return map.typesUi.canControl($scope.type, what, $scope.field);
		};

		$scope.addOption = function() {
			if($scope.field.options == null)
				$scope.field.options = [ ];

			$scope.field.options.push({ key: fpUtils.generateRandomPadId(), value: "" });
		};

		$scope.deleteOption = function(option) {
			var idx = $scope.field.options.indexOf(option);
			if(idx != -1)
				$scope.field.options = $scope.field.options.slice(0, idx).concat($scope.field.options.slice(idx+1));
		};

		$scope.save = function() {
			$scope.$close();
		};
	})

})(FacilPad, jQuery, angular);