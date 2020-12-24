const R = 6371; // km

export function quoteJavaScript(str: string) {
	return "'" + (""+str).replace(/['\\]/g, '\\$1').replace(/\n/g, "\\n") + "'";
}

export function quoteHtml(str: string) {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export function quoteRegExp(str: string) {
	return (str+'').replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
}

export function calculateDistance(posList: Array<{ lat: number; lon: number }>) {
	// From http://stackoverflow.com/a/365853/242365

	let ret = 0;

	for(let i=1; i<posList.length; i++) {
		const lat1 = posList[i-1].lat * Math.PI / 180;
		const lon1 = posList[i-1].lon * Math.PI / 180;
		const lat2 = posList[i].lat * Math.PI / 180;
		const lon2 = posList[i].lon * Math.PI / 180;
		const dLat = lat2-lat1;
		const dLon = lon2-lon1;

		const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
				Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
		ret += R * c;
	}

	return ret;
}
