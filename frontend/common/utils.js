const R = 6371; // km

const utils = module.exports = {
	quoteJavaScript(str) {
		return "'" + (""+str).replace(/['\\]/g, '\\$1').replace(/\n/g, "\\n") + "'";
	},

	quoteHtml(str) {
		return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	},

	quoteRegExp(str) {
		return (str+'').replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
	},

	calculateDistance(posList) {
		// From http://stackoverflow.com/a/365853/242365

		var ret = 0;

		for(var i=1; i<posList.length; i++) {
			var lat1 = posList[i-1].lat * Math.PI / 180;
			var lon1 = posList[i-1].lon * Math.PI / 180;
			var lat2 = posList[i].lat * Math.PI / 180;
			var lon2 = posList[i].lon * Math.PI / 180;
			var dLat = lat2-lat1;
			var dLon = lon2-lon1;

			var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
			        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
			var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
			ret += R * c;
		}

		return ret;
	}
};
