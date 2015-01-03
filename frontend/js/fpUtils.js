(function(fp, $, ng, undefined) {

	fp.app.factory("fpUtils", [ "$parse", function($parse) {

		var fpUtils = { };

		fpUtils.proj = function() {
			return new OpenLayers.Projection("EPSG:4326");
		};

		var LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
		var LENGTH = 12;

		fpUtils.generateRandomPadId = function() {
			var randomPadId = "";
			for(var i=0; i<LENGTH; i++) {
				randomPadId += LETTERS[Math.floor(Math.random() * LETTERS.length)];
			}
			return randomPadId;
		};

		fpUtils.createMarkerGraphic = function(colour, randomTrash) {
			var borderColour = fpUtils.makeTextColour(colour, 0.3);

			var svg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>' +
				'<svg xmlns="http://www.w3.org/2000/svg" width="21" height="25" version="1.1">' +
				(randomTrash ? '<!--' + randomTrash + '-->' : '') + // Chrome seems to have a bug where it applies the CSS styles of one image the same code
				'<g transform="matrix(0.962318,0,0,0.962318,0.35255058,-988.3149)">' +
				'<path style="fill:#' + colour + ';stroke:#' + borderColour + ';stroke-width:1" d="m 0.31494999,1035.8432 10.20437901,-8.1661 10.20438,8.1661 -10.20438,16.204 z" />' +
				'<path style="fill:#' + borderColour + ';stroke:none" d="m 361.63462,62.160149 c 0,10.181526 -8.25375,18.435283 -18.43528,18.435283 -10.18153,0 -18.43528,-8.253757 -18.43528,-18.435283 0,-10.181526 8.25375,-18.435284 18.43528,-18.435284 10.18153,0 18.43528,8.253758 18.43528,18.435284 z" transform="matrix(0.1366727,0,0,0.1366727,-36.38665,1028.6074)" />' +
				'</g>' +
				'</svg>';

			return "data:image/svg+xml;base64,"+btoa(svg);
		};

		fpUtils.createMarkerIcon = function(colour) {
			return new OpenLayers.Icon(fpUtils.createMarkerGraphic(colour), { w: 21, h: 25 }, { x: -9, y: -25 });
		};

		fpUtils.makeTextColour = function(backgroundColour, threshold) {
			if(threshold == null)
				threshold = 0.5;

			var r = parseInt(backgroundColour.substr(0, 2), 16)/255;
			var g = parseInt(backgroundColour.substr(2, 2), 16)/255;
			var b = parseInt(backgroundColour.substr(4, 2), 16)/255;
			// See http://stackoverflow.com/a/596243/242365
			return (Math.sqrt(0.241*r*r + 0.691*g*g + 0.068*b*b) <= threshold) ? "ffffff" : "000000";
		};

		fpUtils.overwriteObject = function(from, to) {
			for(var i in to)
				delete to[i];
			for(var i in from)
				to[i] = from[i];
		};

		fpUtils.quoteJavaScript = function(str) {
			return "'" + (""+str).replace(/['\\]/g, '\\\1').replace(/\n/g, "\\n") + "'";
		};

		fpUtils.round = function(number, digits) {
			var fac = Math.pow(10, digits);
			return Math.round(number*fac)/fac;
		};

		fpUtils.formatTime = function(seconds) {
			var hours = Math.floor(seconds/3600);
			var minutes = Math.floor((seconds%3600)/60);
			if(minutes < 10)
				minutes = "0" + minutes;
			return hours + ":" + minutes;
		};

		fpUtils.routingMode = function(mode) {
			switch(mode) {
				case "fastest":
				case "shortest":
					return "by car";
				case "bicycle":
					return "by bicycle";
				case "pedestrian":
					return "by foot";
				default:
					return "";
			}
		};

		fpUtils.preserveObject = function(scope, sourceExpr, targetExpr, onDelete) {
			var obj,bkp;

			function _update(firstTime) {
				obj = $parse(sourceExpr)(scope);

				if(firstTime && obj == null)
					obj = $parse(targetExpr)(scope);

				bkp = ng.copy(obj);

				if(sourceExpr != targetExpr)
					$parse(targetExpr + " = " + sourceExpr)(scope);
			}

			_update(true);

			var unwatch = scope.$watch(sourceExpr, function(newVal) {
				_update(false);

				if(newVal == null) {
					unwatch();
					if(onDelete)
						onDelete();
				}
			});

			return {
				revert : function() {
					if(bkp == null)
						return;

					fpUtils.overwriteObject(bkp, obj);
					unwatch();
				},
				leave : function() {
					unwatch();
					bkp = null;
				}
			}
		};

		return fpUtils;
	} ]);

})(FacilPad, jQuery, angular);