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

	fp.app.factory("fpTable", [ "fpSocket", "fpDialogs", "$rootScope", function(fpSocket, fpDialogs, $rootScope) {
		return {
			showTable : function() {
				var socket = fpSocket($rootScope.padId);
				socket.updateBbox({ top: 90, left: -180, right: 180, bottom: -90, zoom: 0 });

				fpDialogs.open("table.html", socket, "Table");
			}
		};
	} ]);

})(FacilPad, jQuery, angular);