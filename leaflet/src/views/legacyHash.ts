import { decodeURIComponentTolerantly } from "./hash";

export function decodeQueryString(str: string): any {
	const result: any = { };

	for (const part of str.split(/[;&]/)) {
		const equalSign = part.indexOf("=");
		if(equalSign < 1) continue;

		const key = part.substr(0, equalSign);
		const arrMatch = key.match(/(\[[^\]]*\]|\.[^.]+)+$/);
		if(arrMatch) {
			const indexes = [
				key.substr(0, key.length - arrMatch[0].length),
				...arrMatch[0].replace(/^[.[]/, "").replace(/\]$/, "").split(/\]\[|\./)
			];
			let current = result;
			for (let i = 0; i < indexes.length; i++) {
				let index: string | number = decodeURIComponentTolerantly(indexes[i]);
				if(index.length == 0) {
					index = 0;
					while(typeof current[index] != "undefined")
						index++;
				}
				if(i == indexes.length-1)
					current[index] = decodeURIComponentTolerantly(part.substr(equalSign + 1));
				else {
					if(!current[index] || typeof current[index] != "object")
						current[index] = { };
					current = current[index];
				}
			}
		} else
			result[decodeURIComponentTolerantly(key)] = decodeURIComponentTolerantly(part.substr(equalSign + 1));
	}
	return result;
}

export function decodeLegacyHash(str: string): string[] {
	// Example URLs from FacilMap 1:
	// https://facilmap.org/#lon=11.7268775;lat=53.04781777;zoom=9;layer=MSfR;c.s.type=fastest;c.s.medium=car;q.0=Berlin;q.1=Hamburg;q.2=Bremen
	// https://facilmap.org/#lon=13.4385964;lat=52.5198535;zoom=11;layer=MSfR;q=Berlin
	// https://facilmap.org/#lon=13.4385964;lat=52.5198535;zoom=11;layer=MSfR;l.OPTM.visibility=1;q=Berlin

	const obj = decodeQueryString(str);

	const ret = [ obj.zoom, obj.lat, obj.lon ];

	const layers = [ ];
	if(obj.layer)
		layers.push(obj.layer);
	for(const i in obj.l || { }) {
		if(obj.l[i].visibility)
			layers.push(i);
	}

	ret.push(layers.join("-"));

	if(typeof obj.q == "string")
		ret.push(obj.q);
	else if(typeof obj.s == "string")
		ret.push(obj.s);
	else if(typeof obj.q == "object") {
		const destinations = Object.keys(obj.q).sort((a, b) => Number(a) - Number(b)).map((k) => obj.q[k]);

		let query = destinations.join(' to ');
		if(obj.c && obj.c.s && obj.c.s.medium)
			query += ` by ${obj.c.s.medium != "foot" ? obj.c.s.medium : "pedestrian"}`;
		ret.push(query);
	}

	return ret;
}