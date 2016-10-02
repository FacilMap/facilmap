(function(fp, $, ng, undefined) {

	fp.app.filter("fpType", function() {
		return function(input, typeId) {
			var res = [ ];
			angular.forEach(input, function(it) {
				if(it.typeId == typeId)
					res.push(it);
			});
			return res;
		};
	});

	fp.app.factory("fpTable", function(fpSocket, fpDialogs, $rootScope, fpTypeFields) {
		function _getField(type, fieldName) {
			for(var i=0; i<type.fields.length; i++) {
				if(type.fields[i].name == fieldName)
					return type.fields[i];
			}
		}

		function _normaliseNumbers(text) { // Pads any number in the string with zeros, so that numbers have a unified length and can be string-sorted
			return (text ? ""+text : "").trim().toLowerCase().replace(/\d+/g, function(m) { return ("000000000"+m).slice(-10) });
		}

		return {
			showTable : function() {
				var socket = fpSocket($rootScope.padId);
				socket.updateBbox({ top: 90, left: -180, right: 180, bottom: -90, zoom: 0 });

				socket.sort = function(type, field) {
					socket.sortOrder[type.id] = ((socket.sortField[type.id] == null ? "__name" : socket.sortField[type.id]) == field ? !socket.sortOrder[type.id] : false);
					socket.sortField[type.id] = field;
				};

				socket.getSortField = function(type) {
					var f = socket.sortField[type.id];

					if(f == null || f == "__name" || f == "__distance" || f == "__time")
						return function(it) { return _normaliseNumbers(it[f ? f.replace(/^__/, "") : "name"]) };
					else
						return function(it) { return _normaliseNumbers($("<div/>").append(fpTypeFields.formatField(_getField(type, f), it.data[f])).text()); };
				};

				socket.getSortIcon = function(type, fieldName) {
					return {
						'ui-icon': ((socket.sortField[type.id] == null ? "__name" : socket.sortField[type.id]) == fieldName),
						'ui-icon-triangle-1-s': !socket.sortOrder[type.id],
						'ui-icon-triangle-1-n': socket.sortOrder[type.id]
					};
				};

				socket.sortField = { };
				socket.sortOrder = { };

				fpDialogs.open("table/table.html", socket, "Table", null, true);
			}
		};
	});

})(FacilPad, jQuery, angular);