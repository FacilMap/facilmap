(function(fm, $, ng, undefined) {

	fm.app.filter("fmType", function() {
		return function(input, typeId) {
			var res = [ ];
			angular.forEach(input, function(it) {
				if(it.typeId == typeId)
					res.push(it);
			});
			return res;
		};
	});

	fm.app.factory("fmTable", function(fmSocket, $rootScope, $uibModal) {
		return {
			showTable : function(padId) {
				var socket = fmSocket(padId);
				socket.updateBbox({ top: 90, left: -180, right: 180, bottom: -90, zoom: 0 });
				
				$uibModal.open({
					templateUrl: "table/table.html",
					scope: socket,
					controller: "fmTableCtrl",
					size: "fs"
				});
			}
		};
	});
	
	fm.app.controller("fmTableCtrl", function($scope, fmTypeFields) {
		function _getField(type, fieldName) {
			for(var i=0; i<type.fields.length; i++) {
				if(type.fields[i].name == fieldName)
					return type.fields[i];
			}
		}

		function _normaliseNumbers(text) { // Pads any number in the string with zeros, so that numbers have a unified length and can be string-sorted
			return (text ? ""+text : "").trim().toLowerCase().replace(/\d+/g, function(m) { return ("000000000"+m).slice(-10) });
		}

		$scope.sort = function(type, field) {
			$scope.sortOrder[type.id] = (($scope.sortField[type.id] == null ? "__name" : $scope.sortField[type.id]) == field ? !$scope.sortOrder[type.id] : false);
			$scope.sortField[type.id] = field;
		};

		$scope.getSortField = function(type) {
			var f = $scope.sortField[type.id];

			if(f == null || f == "__name" || f == "__distance" || f == "__time")
				return function(it) { return _normaliseNumbers(it[f ? f.replace(/^__/, "") : "name"]) };
			else
				return function(it) { return _normaliseNumbers($("<div/>").append(fmTypeFields.formatField(_getField(type, f), it.data[f])).text()); };
		};

		$scope.getSortClass = function(type, fieldName) {
			if(($scope.sortField[type.id] == null ? "__name" : $scope.sortField[type.id]) == fieldName) {
				return $scope.sortOrder[type.id] ? "sort-up" : "sort-down";
			} else {
				return "sort-none";
			}
		};

		$scope.getSortIcon = function(type, fieldName) {
			if(($scope.sortField[type.id] == null ? "__name" : $scope.sortField[type.id]) == fieldName) {
				return {
					'glyphicon': true,
					'glyphicon-triangle-bottom': !$scope.sortOrder[type.id],
					'glyphicon-triangle-top': $scope.sortOrder[type.id]
				};
			} else {
				return { };
			}
		};

		$scope.sortField = { };
		$scope.sortOrder = { };
	})

})(FacilMap, jQuery, angular);