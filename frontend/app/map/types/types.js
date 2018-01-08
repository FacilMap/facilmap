import fm from '../../app';

fm.app.factory("fmMapTypes", function($uibModal, fmUtils, $rootScope) {
	return function(map) {
		var ret = {
			editTypes : function() {
				let scope = $rootScope.$new();
				scope.client = map.client;

				$uibModal.open({
					template: require("./edit-types.html"),
					scope: scope,
					controller: "fmMapTypesEditCtrl",
					size: "lg",
					resolve: {
						map: function() { return map; }
					}
				});
			},
			editType : function(type) {
				var scope = $rootScope.$new();
				scope.client = map.client;
				scope.type = type;

				scope.$watch("type.fields", (fields) => {
					fields.forEach((field) => {
						field.oldName = field.name;
					});
				});

				var dialog = $uibModal.open({
					template: require("./edit-type.html"),
					scope: scope,
					controller: "fmMapTypesEditTypeCtrl",
					size: "lg",
					resolve: {
						map: function() { return map; }
					}
				});

				var preserve = fmUtils.preserveObject(scope, type.id ? "client.types["+fmUtils.quoteJavaScript(type.id)+"]" : "type", "type", function() {
					dialog.dismiss();
				});

				dialog.result.then(preserve.leave.bind(preserve), preserve.revert.bind(preserve));
			},
			editTypeDropdown : function(type, field) {
				var scope = $rootScope.$new();
				scope.type = type;
				scope.field = field;

				if(field.type == 'checkbox') {
					if(!field.options || field.options.length != 2) {
						field.options = [
							{ value: '' },
							{ value: field.name }
						]
					}

					// Convert legacy format
					if(field.options[0].value == "0")
						field.options[0].value = "";
					if(field.options[1].value == "1")
						field.options[1].value = field.name;
				}

				for(let option of (field.options || []))
					option.oldValue = option.value;

				var dialog = $uibModal.open({
					template: require("./edit-type-dropdown.html"),
					scope: scope,
					controller: "fmMapTypesEditTypeDropdownCtrl",
					size: "lg",
					resolve: {
						map: function() { return map; }
					}
				});

				var preserve = fmUtils.preserveObject(scope, "field", "field", function() {
					dialog.dismiss();
				});

				dialog.result.then(preserve.leave.bind(preserve), preserve.revert.bind(preserve));
			},
			canControl : function(type, what, ignoreField) {
				if(type[what+"Fixed"] && ignoreField !== null)
					return false;

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

fm.app.controller('fmMapTypesEditCtrl', function($scope, map) {
	$scope.saving = {};

	$scope.create = function() {
		$scope.edit({
			fields : [ ]
		});
	};

	$scope.edit = map.typesUi.editType.bind(map.typesUi);

	$scope['delete'] = function(type) {
		$scope.saving[type.id] = true;
		$scope.error = null;
		map.client.deleteType({ id: type.id }).catch(function(err) {
			$scope.error = err;
			$scope.saving[type.id] = false;
		});
	};
});

fm.app.controller('fmMapTypesEditTypeCtrl', function($scope, map, fmSortableOptions) {
	$scope.sortableOptions = fmSortableOptions;

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
		$scope.saving = true;

		[ "defaultWidth", "defaultSize", "defaultColour" ].forEach(function(prop) {
			if($scope.type[prop] == "")
				$scope.type[prop] = null;
		});

		($scope.type.id == null ? map.client.addType($scope.type) : map.client.editType($scope.type)).then(function() {
			$scope.$close();
		}).catch(function(err) {
			$scope.error = err;
			$scope.saving = false;
		});
	};

	$scope.canControl = function(what) {
		return map.typesUi.canControl($scope.type, what, null);
	};
});

fm.app.controller('fmMapTypesEditTypeDropdownCtrl', function($scope, map, fmUtils, fmSortableOptions) {
	$scope.sortableOptions = fmSortableOptions;

	$scope.canControl = function(what) {
		return map.typesUi.canControl($scope.type, what, $scope.field);
	};

	$scope.addOption = function() {
		if($scope.field.options == null)
			$scope.field.options = [ ];

		$scope.field.options.push({ value: "" });
	};

	$scope.deleteOption = function(option) {
		var idx = $scope.field.options.indexOf(option);
		if(idx != -1)
			$scope.field.options = $scope.field.options.slice(0, idx).concat($scope.field.options.slice(idx+1));
	};

	$scope.save = function() {
		$scope.$close();
	};
});
