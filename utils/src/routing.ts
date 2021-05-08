import { RouteMode } from "facilmap-types";

export interface DecodedRouteMode {
	mode: "" | "car" | "bicycle" | "pedestrian" | "track";
	type: "" | "hgv" | "road" | "mountain" | "electric" | "hiking" | "wheelchair";
	preference: "fastest" | "shortest";
	details: boolean;
	avoid: Array<"highways" | "tollways" | "ferries" | "fords" | "steps">;
}

export const R = 6371; // km

export function calculateDistance(posList: Array<{ lat: number; lon: number; }>): number {
	// From http://stackoverflow.com/a/365853/242365
	let ret = 0;

	for (let i = 1; i < posList.length; i++) {
		const lat1 = posList[i - 1].lat * Math.PI / 180;
		const lon1 = posList[i - 1].lon * Math.PI / 180;
		const lat2 = posList[i].lat * Math.PI / 180;
		const lon2 = posList[i].lon * Math.PI / 180;
		const dLat = lat2 - lat1;
		const dLon = lon2 - lon1;

		const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		ret += R * c;
	}

	return ret;
}

export function encodeRouteMode(decodedMode: DecodedRouteMode): string {
	const encodedMode = [];

	if(decodedMode) {
		if(decodedMode.mode)
			encodedMode.push(decodedMode.mode);
		if(decodedMode.type)
			encodedMode.push(decodedMode.type);
		if(decodedMode.preference && decodedMode.preference != "fastest")
			encodedMode.push(decodedMode.preference);
		if(decodedMode.details)
			encodedMode.push("details");
		if(decodedMode.avoid && decodedMode.avoid.length > 0)
			encodedMode.push("avoid", ...decodedMode.avoid);
	}

	return encodedMode.join(" ");
}

export function decodeRouteMode(encodedMode: RouteMode | undefined): DecodedRouteMode {
	const decodedMode: DecodedRouteMode = {
		mode: "",
		type: "",
		preference: "fastest",
		details: false,
		avoid: []
	};

	if(encodedMode) {
		for(const part of encodedMode.split(/\s+/)) {
			if(["car", "bicycle", "pedestrian", "track"].includes(part))
				decodedMode.mode = part as any;
			else if(part == "bike")
				decodedMode.mode = "bicycle";
			else if(["foot", "walk", "walking"].includes(part))
				decodedMode.mode = "pedestrian";
			else if(["helicopter", "straight"].includes(part))
				decodedMode.mode = "";
			else if(["hgv", "road", "mountain", "electric", "hiking", "wheelchair"].includes(part))
				decodedMode.type = part as any;
			else if (part == "recommended")
				decodedMode.preference = "fastest";
			else if(["fastest", "shortest"].includes(part))
				decodedMode.preference = part as any;
			else if(part == "details")
				decodedMode.details = true;
			else if(["highways", "tollways", "ferries", "fords", "steps"].includes(part))
				decodedMode.avoid.push(part as any);
		}
	}

	return decodedMode;
}

export function formatRouteMode(encodedMode: RouteMode): string {
	const decodedMode = decodeRouteMode(encodedMode);

	switch(decodedMode.mode) {
		case "car":
			switch(decodedMode.type) {
				case "hgv":
					return "by HGV";
				default:
					return "by car";
			}
		case "bicycle":
			switch(decodedMode.type) {
				case "road":
					return "by road bike";
				case "mountain":
					return "by mountain bike";
				case "electric":
					return "by electric bike";
				default:
					return "by bicycle";
			}
		case "pedestrian":
			switch(decodedMode.type) {
				case "wheelchair":
					return "by wheelchair";
				default:
					return "on foot";
			}
		default:
			return "";
	}
}
