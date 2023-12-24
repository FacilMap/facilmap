import "leaflet.heightgraph";
import { Control, type Map, Polyline } from "leaflet";
import "leaflet.heightgraph/src/L.Control.Heightgraph.css";
import "./heightgraph.scss";
import type { TrackPoints } from "facilmap-client";
import type { ExtraInfo, TrackPoint } from "facilmap-types";
import type { FeatureCollection } from "geojson";
import { calculateDistance, round } from "facilmap-utils";

function trackSegment(trackPoints: TrackPoints, fromIdx: number, toIdx: number): TrackPoint[] {
	let ret: TrackPoint[] = [];

	for(let i=fromIdx; i<trackPoints.length; i++) {
		if(trackPoints[i] && trackPoints[i].ele != null) {
			ret.push(trackPoints[i]);

			if(i >= toIdx) // Makes sure that if toIdx does not exist in trackPoints, the next trackPoint is added, which avoids gaps between the segments, as required by leaflet.heightgraph
				break;
		}
	}

	return ret;
}

type Collection = FeatureCollection & {
	properties: {
		summary: string;
		distances: Record<number, number>;
	};
}

function createGeoJsonForHeightGraph(extraInfo: ExtraInfo | undefined, trackPoints: TrackPoints): Collection[] {
	const geojson: Collection[] = [];

	if(!extraInfo || Object.keys(extraInfo).length == 0)
		extraInfo = { "": [[ 0, trackPoints.length-1, "" as any ]] };

	for(const i of Object.keys(extraInfo)) {
		let featureCollection: Collection = {
			type: "FeatureCollection",
			features: [],
			properties: {
				summary: i,
				distances: {}
			}
		};

		const distances = featureCollection.properties.distances;

		for(let segment in extraInfo[i]) {
			const segmentPosList = trackSegment(trackPoints, extraInfo[i][segment][0], extraInfo[i][segment][1]);

			if (distances[extraInfo[i][segment][2]] == null)
				distances[extraInfo[i][segment][2]] = 0;
			distances[extraInfo[i][segment][2]] += calculateDistance(segmentPosList);

			featureCollection.features.push({
				type: "Feature",
				geometry: {
					type: "LineString",
					coordinates: segmentPosList.map((trackPoint) => ([trackPoint.lon, trackPoint.lat, ...(trackPoint.ele != null ? [trackPoint.ele] : [])]))
				},
				properties: {
					attributeType: extraInfo[i][segment][2]
				}
			});
		}

		geojson.push(featureCollection);
	}
	return geojson;
}

function getDistancesByInfoType(extraInfo: ExtraInfo[string] | undefined, trackPoints: TrackPoints): Record<number, number> {
	const ret: Record<number, number> = { };

	if (!extraInfo)
		return ret;

	for(let segment in extraInfo) {
		if (ret[extraInfo[segment][2]] == null)
			ret[extraInfo[segment][2]] = 0;

		ret[extraInfo[segment][2]] += calculateDistance(trackSegment(trackPoints, extraInfo[segment][0], extraInfo[segment][1]));
	}

	return ret;
}

export function createElevationStats(extraInfo: ExtraInfo | undefined, trackPoints: TrackPoints): Record<number, number> | null {
	if (!extraInfo || !extraInfo.steepness)
		return null;

	const stats = getDistancesByInfoType(extraInfo.steepness, trackPoints);

	const sum = (filter: (i: number) => boolean): number => Object.keys(stats).map((i) => parseInt(i, 10)).filter(filter).reduce((acc, cur) => acc + stats[cur], 0);

	return {
		"-16": sum((i) => (i <= -5)),
		"-10": sum((i) => (i <= -4)),
		"-7": sum((i) => (i <= -3)),
		"-4": sum((i) => (i <= -2)),
		"-1": sum((i) => (i <= -1)),
		"0": sum((i) => (i == 0)),
		"1": sum((i) => (i >= 1)),
		"4": sum((i) => (i >= 2)),
		"7": sum((i) => (i >= 3)),
		"10": sum((i) => (i >= 4)),
		"16": sum((i) => (i >= 5))
	};
}

export default class FmHeightgraph extends Control.Heightgraph {
	constructor(options?: any) {
		super({
			margins: {
				top: 20,
				right: 10,
				bottom: 45,
				left: 50
			},
			mappings: {
				"": {
					"": { text: 'unknown', color: '#4682B4' }
				},
				steepness: {
					"-5": { text: "- 16%+", color: "#028306" },
					"-4": { text: "- 10-15%", color: "#2AA12E" },
					"-3": { text: "- 7-9%", color: "#53BF56" },
					"-2": { text: "- 4-6%", color: "#7BDD7E" },
					"-1": { text: "- 1-3%", color: "#A4FBA6" },
					"0": { text: "0%", color: "#ffcc99" },
					"1": { text: "1-3%", color: "#F29898" },
					"2": { text: "4-6%", color: "#E07575" },
					"3": { text: "7-9%", color: "#CF5352" },
					"4": { text: "10-15%", color: "#BE312F" },
					"5": { text: "16%+", color: "#AD0F0C" }
				},
				waytypes: {
					"0": { text: "Other", color: "#30959e" },
					"1": { text: "StateRoad", color: "#3f9da6" },
					"2": { text: "Road", color: "#4ea5ae" },
					"3": { text: "Street", color: "#5baeb5" },
					"4": { text: "Path", color: "#67b5bd" },
					"5": { text: "Track", color: "#73bdc4" },
					"6": { text: "Cycleway", color: "#7fc7cd" },
					"7": { text: "Footway", color: "#8acfd5" },
					"8": { text: "Steps", color: "#96d7dc" },
					"9": { text: "Ferry", color: "#a2dfe5" },
					"10": { text: "Construction", color: "#ade8ed" }
				},
				surface: {
					"0": { text: "Other", color: "#ddcdeb" },
					"1": { text: "Paved", color: "#cdb8df" },
					"2": { text: "Unpaved", color: "#d2c0e3" },
					"3": { text: "Asphalt", color: "#bca4d3" },
					"4": { text: "Concrete", color: "#c1abd7" },
					"5": { text: "Cobblestone", color: "#c7b2db" },
					"6": { text: "Metal", color: "#e8dcf3" },
					"7": { text: "Wood", color: "#eee3f7" },
					"8": { text: "Compacted Gravel", color: "#d8c6e7" },
					"9": { text: "Fine Gravel", color: "#8f9de4" },
					"10": { text: "Gravel", color: "#e3d4ef" },
					"11": { text: "Dirt", color: "#99a6e7" },
					"12": { text: "Ground", color: "#a3aeeb" },
					"13": { text: "Ice", color: "#acb6ee" },
					"14": { text: "Paving Stones", color: "#b6c0f2" },
					"15": { text: "Sand", color: "#c9d1f8" },
					"16": { text: "Woodchips", color: "#c0c8f5" },
					"17": { text: "Grass", color: "#d2dafc" },
					"18": { text: "Grass Paver", color: "#dbe3ff" }
				},
				suitability: {
					"3": { text: "3/10", color: "#3D3D3D" },
					"4": { text: "4/10", color: "#4D4D4D" },
					"5": { text: "5/10", color: "#5D5D5D" },
					"6": { text: "6/10", color: "#6D6D6D" },
					"7": { text: "7/10", color: "#7C7C7C" },
					"8": { text: "8/10", color: "#8D8D8D" },
					"9": { text: "9/10", color: "#9D9D9D" },
					"10": { text: "10/10", color: "#ADADAD" }
				},
				green: {
					"3": { text: "10/10", color: "#8ec639" },
					"4": { text: "9/10", color: "#99c93c" },
					"5": { text: "8/10", color: "#a4cc40" },
					"6": { text: "7/10", color: "#afcf43" },
					"7": { text: "6/10", color: "#bbd246" },
					"8": { text: "5/10", color: "#c6d54a" },
					"9": { text: "4/10", color: "#d1d84e" },
					"10": { text: "3/10", color: "#dcdc51" }
				},
				noise: {
					"7": { text: "7/10", color: "#F8A056" },
					"8": { text: "8/10", color: "#EA7F27" },
					"9": { text: "9/10", color: "#A04900" },
					"10": { text: "10/10", color: "#773600" }
				},
				tollways: {
					"0": { text: "LOCALE_NO_TOLLWAY", color: "#6ca97b" },
					"1": { text: "LOCALE_TOLLWAY", color: "#ffb347" }
				},
				avgspeed: {
					"3": { text: "3 km/h", color: "#f2fdff" },
					"4": { text: "4 km/h", color: "#D8FAFF" },
					"5": { text: "5 km/h", color: "bff7ff" },
					"6": { text: "6-8 km/h", color: "#f2f7ff" },
					"9": { text: "9-12 km/h", color: "#d8e9ff" },
					"13": { text: "13-16 km/h", color: "#bedaff" },
					"17": { text: "17-20 km/h", color: "#a5cbff" },
					"21": { text: "21-24 km/h", color: "#8cbcff" },
					"25": { text: "25-29 km/h", color: "#72aeff" },
					"30": { text: "30-34 km/h", color: "#599fff" },
					"35": { text: "35-39 km/h", color: "#3f91ff" },
					"40": { text: "40-44 km/h", color: "#2682ff" },
					"45": { text: "45-49 km/h", color: "#0d73ff" },
					"50": { text: "50-59 km/h", color: "#0067f2" },
					"60": { text: "60-69 km/h", color: "#005cd9" },
					"70": { text: "70-79 km/h", color: "#0051c0" },
					"80": { text: "80-99 km/h", color: "#0046a6" },
					"100": { text: "100-119 km/h", color: "#003c8d" },
					"120": { text: "+120 km/h", color: "#003174" }
				},
				traildifficulty: {
					"0": { text: "Missing SAC tag", color: "#dfecec" },
					"1": { text: "S0", color: "#9fc6c6" },
					"2": { text: "S1", color: "#80b3b3" },
					"3": { text: "S2", color: "#609f9f" },
					"4": { text: "S3", color: "#4d8080" },
					"5": { text: "S4", color: "#396060" },
					"6": { text: "S5", color: "#264040" },
					"7": { text: ">S5", color: "#132020" }
				},
				roadaccessrestrictions: {
					"0": { text: "None (there are no restrictions)", color: "#fe7f6c" },
					"1": { text: "No", color: "#FE7F9C" },
					"2": { text: "Customers", color: "#FDAB9F" },
					"4": { text: "Destination", color: "#FF66CC" },
					"8": { text: "Delivery", color: "#FDB9C8" },
					"16": { text: "Private", color: "#F64A8A" },
					"32": { text: "Permissive", color: "#E0115F" }
				}
			},
			...options
		});

		for (const i of Object.keys(this.options.mappings)) {
			for (const j of Object.keys(this.options.mappings[i])) {
				this.options.mappings[i][j].originalText = this.options.mappings[i][j].text;
			}
		}
	}

	onAdd(map: Map): Element {
		// Initialize renderer on overlay pane because Heightgraph renders the hover overlay there (it appends it to .leaflet-overlay-pane svg)
		map.getRenderer(new Polyline([]));

		return super.onAdd(map);
	}

	addData(extraInfo: ExtraInfo | undefined, trackPoints: TrackPoints): void {
		let data = createGeoJsonForHeightGraph(extraInfo, trackPoints);

		for (const featureCollection of data) {
			for (const i in featureCollection.properties.distances) {
				const mapping = this.options.mappings[featureCollection.properties.summary] && this.options.mappings[featureCollection.properties.summary][i];
				if (mapping)
					mapping.text = mapping.originalText + " (" + round(featureCollection.properties.distances[i], 2) + " km)";
			}
		}

		if(this._container)
			super.addData(data);
		else
			this._data = data;
	}

}