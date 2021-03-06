import fm from '../../app';
import ng from 'angular';

fm.app.factory("fmMapTypesUtils", function(fmUtils) {
	function getIdxForInsertingField(targetFields, targetField, mergedFields) {
		// Check which field comes after the field in the target field list, and return the index of that field in mergedFields

		for(let i = targetFields.indexOf(targetField) + 1; i < targetFields.length; i++) {
			if(!targetFields[i].oldName)
				continue;

			let thisIdxInMergedFields = mergedFields.findIndex(field => field.oldName == targetFields[i].oldName);
			if(thisIdxInMergedFields != -1)
				return thisIdxInMergedFields;
		}

		return mergedFields.length;
	}

	function mergeFields(oldFields, newFields, customFields) {
		let mergedFields = newFields.map((newField) => {
			let oldField = oldFields.find((field) => (field.name == newField.name));
			let customField = customFields.find((field) => (field.oldName == newField.name));

			if(oldField && !customField) // Field has been removed in customFields
				return null;
			else if(!customField)
				return Object.assign({}, newField, {oldName: newField.name});

			let mergedField = ng.copy(customField);
			fmUtils.mergeObject(oldField, newField, mergedField);

			return mergedField;
		}).filter(field => field != null);

		// Fields that don't have an oldName have been created, so we have to add them again
		for(let customField of customFields.filter(field => !field.oldName))
			mergedFields.splice(getIdxForInsertingField(customFields, customField, mergedFields), 0, customField);

		return mergedFields;
	}

	let fmMapTypesUtils = {
		mergeTypeObject(oldObject, newObject, targetObject) {
			let customFields = ng.copy(targetObject.fields);

			fmUtils.mergeObject(oldObject, newObject, targetObject);

			targetObject.fields = mergeFields(oldObject.fields, newObject.fields, customFields);
		}
	};
	return fmMapTypesUtils;
});

fm.app.factory("fmMapTypes", function($uibModal, fmUtils, $rootScope) {
	return function(map) {
		var ret = {
			editTypes : function() {
				$uibModal.open({
					template: require("./edit-types.html"),
					controller: "fmMapTypesEditCtrl",
					size: "lg",
					resolve: {
						map: function() { return map; }
					}
				});
			},
			editType : function(type) {
				$uibModal.open({
					template: require("./edit-type.html"),
					controller: "fmMapTypesEditTypeCtrl",
					size: "lg",
					resolve: {
						map: () => (map),
						type: () => (type)
					}
				});
			},
			editTypeDropdown : function(type, field) {
				$uibModal.open({
					template: require("./edit-type-dropdown.html"),
					controller: "fmMapTypesEditTypeDropdownCtrl",
					size: "lg",
					resolve: {
						map: () => (map),
						type: () => (type),
						field: () => (field)
					}
				});
			}
		};
		return ret;
	};
});

fm.app.controller('fmMapTypesEditCtrl', function($scope, map) {
	$scope.client = map.client;
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

fm.app.controller('fmMapTypesEditTypeCtrl', function($scope, map, fmSortableOptions, type, fmUtils, fmMapTypesUtils) {
	$scope.client = map.client;
	$scope.type = ng.copy(type);

	for(let field of $scope.type.fields) {
		field.oldName = field.name;
	}

	if(type.id != null) {
		$scope.$watch(() => (map.client.types[type.id]), (newType, oldType) => {
			if(newType == null)
				$scope.$dismiss();
			else {
				fmMapTypesUtils.mergeTypeObject(oldType, newType, $scope.type);

				updateModified();
			}
		}, true);

		$scope.$watch("type", updateModified, true);

		function updateModified() {
			let typeWithOldNames = ng.copy(map.client.types[type.id]);
			for(let field of typeWithOldNames.fields)
				field.oldName = field.name;
			$scope.isModified = !ng.equals($scope.type, typeWithOldNames);
		}
	} else {
		$scope.isModified = true;
	}

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

fm.app.controller('fmMapTypesEditTypeDropdownCtrl', function($scope, map, fmUtils, fmSortableOptions, type, field) {
	$scope.type = type;
	$scope.field = ng.copy(field);

	if(type.id != null && $scope.field.oldName) {
		$scope.$watch(() => {
			let extType = map.client.types[type.id];
			return extType && extType.fields.find(thisField => thisField.name == $scope.field.oldName);
		}, (newField, oldField) => {
			if(newField == null)
				$scope.$dismiss();
			else {
				fmUtils.mergeObject(newField, oldField, $scope.field);
				updateModified();
			}
		}, true);

		$scope.$watch("field", updateModified, true);

		function updateModified() {
			let fieldWithOldName = Object.assign(ng.copy(map.client.types[type.id].fields.find(thisField => thisField.name == $scope.field.oldName)), {
				oldName: $scope.field.oldName,
				name: $scope.field.name,
				type: $scope.field.type
			});
			$scope.isModified = !ng.equals($scope.field, fieldWithOldName);
		}
	} else {
		$scope.isModified = true;
	}

	if($scope.field.type == 'checkbox') {
		if(!$scope.field.options || $scope.field.options.length != 2) {
			$scope.field.options = [
				{ value: '' },
				{ value: $scope.field.name }
			]
		}

		// Convert legacy format
		if($scope.field.options[0].value == "0")
			$scope.field.options[0].value = "";
		if($scope.field.options[1].value == "1")
			$scope.field.options[1].value = $scope.field.name;
	}

	for(let option of ($scope.field.options || []))
		option.oldValue = option.value;


	$scope.sortableOptions = fmSortableOptions;

	$scope.canControl = function(what) {
		return map.typesUi.canControl($scope.type, what, type.fields.find((field) => (field.oldName ? field.oldName == $scope.field.oldName : field.name == $scope.field.name)));
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
		let idx = type.fields.findIndex((field) => (field.oldName ? field.oldName == $scope.field.oldName : field.name == $scope.field.name));
		type.fields[idx] = $scope.field;

		$scope.$close();
	};
});
