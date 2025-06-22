import "leaflet.heightgraph";
import { Control, Polyline } from "leaflet";
import "leaflet.heightgraph/src/L.Control.Heightgraph.css";
import "./heightgraph.scss";
import type { TrackPoints } from "facilmap-client";
import { type ExtraInfo, type TrackPoint } from "facilmap-types";
import type { FeatureCollection } from "geojson";
import { calculateDistance, formatDistance, formatElevation, getCurrentUnits } from "facilmap-utils";
import { getI18n } from "./i18n";

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
	private translatedMapping: Record<"steepness" | "waytype" | "surface" | "suitablity" | "green" | "noise" | "tollways" | "avgspeed" | "traildifficulty" | "roadaccessrestrictions", string>;

	constructor(options?: any) {
		// Consume current units in constructor to mark it as a reactive dependency
		getCurrentUnits();

		const i18n = getI18n();
		const translatedMapping: typeof FmHeightgraph["translatedMapping"] = {
			steepness: i18n.t("heightgraph.steepness"),
			waytype: i18n.t("heightgraph.waytype"),
			surface: i18n.t("heightgraph.surface"),
			suitablity: i18n.t("heightgraph.suitability"),
			green: i18n.t("heightgraph.green"),
			noise: i18n.t("heightgraph.noise"),
			tollways: i18n.t("heightgraph.tollways"),
			avgspeed: i18n.t("heightgraph.avgspeed"),
			traildifficulty: i18n.t("heightgraph.traildifficulty"),
			roadaccessrestrictions: i18n.t("heightgraph.roadaccessrestrictions")
		};

		super({
			margins: {
				top: 20,
				right: 10,
				bottom: 45,
				left: 50
			},
			translation: {
				distance: i18n.t("heightgraph.distance"),
				elevation: i18n.t("heightgraph.elevation"),
				segment_length: i18n.t("heightgraph.segment-length"),
				type: i18n.t("heightgraph.type"),
				legend: i18n.t("heightgraph.legend")
			},
			mappings: {
				"": {
					"": { text: i18n.t("heightgraph.unknown"), color: '#4682B4' }
				},
				[translatedMapping.steepness]: {
					"-5": { text: "−16 % +", color: "#028306" },
					"-4": { text: "−10–15 %", color: "#2AA12E" },
					"-3": { text: "−7–9 %", color: "#53BF56" },
					"-2": { text: "−4–6 %", color: "#7BDD7E" },
					"-1": { text: "−1–3 %", color: "#A4FBA6" },
					"0": { text: "0 %", color: "#ffcc99" },
					"1": { text: "1–3 %", color: "#F29898" },
					"2": { text: "4–6 %", color: "#E07575" },
					"3": { text: "7–9 %", color: "#CF5352" },
					"4": { text: "10–15 %", color: "#BE312F" },
					"5": { text: "16 % +", color: "#AD0F0C" }
				},
				[translatedMapping.waytype]: {
					"0": { text: i18n.t("heightgraph.waytype-other"), color: "#30959e" },
					"1": { text: i18n.t("heightgraph.waytype-state-road"), color: "#3f9da6" },
					"2": { text: i18n.t("heightgraph.waytype-road"), color: "#4ea5ae" },
					"3": { text: i18n.t("heightgraph.waytype-street"), color: "#5baeb5" },
					"4": { text: i18n.t("heightgraph.waytype-path"), color: "#67b5bd" },
					"5": { text: i18n.t("heightgraph.waytype-track"), color: "#73bdc4" },
					"6": { text: i18n.t("heightgraph.waytype-cycleway"), color: "#7fc7cd" },
					"7": { text: i18n.t("heightgraph.waytype-footway"), color: "#8acfd5" },
					"8": { text: i18n.t("heightgraph.waytype-steps"), color: "#96d7dc" },
					"9": { text: i18n.t("heightgraph.waytype-ferry"), color: "#a2dfe5" },
					"10": { text: i18n.t("heightgraph.waytype-construction"), color: "#ade8ed" }
				},
				[translatedMapping.surface]: {
					"0": { text: i18n.t("heightgraph.surface-other"), color: "#ddcdeb" },
					"1": { text: i18n.t("heightgraph.surface-paved"), color: "#cdb8df" },
					"2": { text: i18n.t("heightgraph.surface-unpaved"), color: "#d2c0e3" },
					"3": { text: i18n.t("heightgraph.surface-asphalt"), color: "#bca4d3" },
					"4": { text: i18n.t("heightgraph.surface-contrete"), color: "#c1abd7" },
					"5": { text: i18n.t("heightgraph.surface-cobblestone"), color: "#c7b2db" },
					"6": { text: i18n.t("heightgraph.surface-metal"), color: "#e8dcf3" },
					"7": { text: i18n.t("heightgraph.surface-wood"), color: "#eee3f7" },
					"8": { text: i18n.t("heightgraph.surface-compacted-gravel"), color: "#d8c6e7" },
					"9": { text: i18n.t("heightgraph.surface-fine-gravel"), color: "#8f9de4" },
					"10": { text: i18n.t("heightgraph.surface-gravel"), color: "#e3d4ef" },
					"11": { text: i18n.t("heightgraph.surface-dirt"), color: "#99a6e7" },
					"12": { text: i18n.t("heightgraph.surface-ground"), color: "#a3aeeb" },
					"13": { text: i18n.t("heightgraph.surface-ice"), color: "#acb6ee" },
					"14": { text: i18n.t("heightgraph.surface-paving-stones"), color: "#b6c0f2" },
					"15": { text: i18n.t("heightgraph.surface-sand"), color: "#c9d1f8" },
					"16": { text: i18n.t("heightgraph.surface-woodchips"), color: "#c0c8f5" },
					"17": { text: i18n.t("heightgraph.surface-grass"), color: "#d2dafc" },
					"18": { text: i18n.t("heightgraph.surface-grass-paver"), color: "#dbe3ff" }
				},
				[translatedMapping.suitability]: {
					"3": { text: "3/10", color: "#3D3D3D" },
					"4": { text: "4/10", color: "#4D4D4D" },
					"5": { text: "5/10", color: "#5D5D5D" },
					"6": { text: "6/10", color: "#6D6D6D" },
					"7": { text: "7/10", color: "#7C7C7C" },
					"8": { text: "8/10", color: "#8D8D8D" },
					"9": { text: "9/10", color: "#9D9D9D" },
					"10": { text: "10/10", color: "#ADADAD" }
				},
				[translatedMapping.green]: {
					"3": { text: "10/10", color: "#8ec639" },
					"4": { text: "9/10", color: "#99c93c" },
					"5": { text: "8/10", color: "#a4cc40" },
					"6": { text: "7/10", color: "#afcf43" },
					"7": { text: "6/10", color: "#bbd246" },
					"8": { text: "5/10", color: "#c6d54a" },
					"9": { text: "4/10", color: "#d1d84e" },
					"10": { text: "3/10", color: "#dcdc51" }
				},
				[translatedMapping.noise]: {
					"7": { text: "7/10", color: "#F8A056" },
					"8": { text: "8/10", color: "#EA7F27" },
					"9": { text: "9/10", color: "#A04900" },
					"10": { text: "10/10", color: "#773600" }
				},
				[translatedMapping.tollways]: {
					"0": { text: i18n.t("heightgraph.tollway-no"), color: "#6ca97b" },
					"1": { text: i18n.t("heightgraph.tollway-yes"), color: "#ffb347" }
				},
				[translatedMapping.avgspeed]: {
					// TODO: Make these available in miles
					"3": { text: "3 km/h", color: "#f2fdff" },
					"4": { text: "4 km/h", color: "#D8FAFF" },
					"5": { text: "5 km/h", color: "bff7ff" },
					"6": { text: "6–8 km/h", color: "#f2f7ff" },
					"9": { text: "9–12 km/h", color: "#d8e9ff" },
					"13": { text: "13–16 km/h", color: "#bedaff" },
					"17": { text: "17–20 km/h", color: "#a5cbff" },
					"21": { text: "21–24 km/h", color: "#8cbcff" },
					"25": { text: "25–29 km/h", color: "#72aeff" },
					"30": { text: "30–34 km/h", color: "#599fff" },
					"35": { text: "35–39 km/h", color: "#3f91ff" },
					"40": { text: "40–44 km/h", color: "#2682ff" },
					"45": { text: "45–49 km/h", color: "#0d73ff" },
					"50": { text: "50–59 km/h", color: "#0067f2" },
					"60": { text: "60–69 km/h", color: "#005cd9" },
					"70": { text: "70–79 km/h", color: "#0051c0" },
					"80": { text: "80–99 km/h", color: "#0046a6" },
					"100": { text: "100–119 km/h", color: "#003c8d" },
					"120": { text: "+120 km/h", color: "#003174" }
				},
				[translatedMapping.traildifficulty]: {
					"0": { text: i18n.t("heightgraph.traildifficulty-unknown"), color: "#dfecec" },
					"1": { text: "S0", color: "#9fc6c6" },
					"2": { text: "S1", color: "#80b3b3" },
					"3": { text: "S2", color: "#609f9f" },
					"4": { text: "S3", color: "#4d8080" },
					"5": { text: "S4", color: "#396060" },
					"6": { text: "S5", color: "#264040" },
					"7": { text: ">S5", color: "#132020" }
				},
				[translatedMapping.roadaccessrestrictions]: {
					"0": { text: i18n.t("heightgraph.access-yes"), color: "#fe7f6c" },
					"1": { text: i18n.t("heightgraph.access-no"), color: "#FE7F9C" },
					"2": { text: i18n.t("heightgraph.access-customers"), color: "#FDAB9F" },
					"4": { text: i18n.t("heightgraph.access-destination"), color: "#FF66CC" },
					"8": { text: i18n.t("heightgraph.access-delivery"), color: "#FDB9C8" },
					"16": { text: i18n.t("heightgraph.access-private"), color: "#F64A8A" },
					"32": { text: i18n.t("heightgraph.access-permissive"), color: "#E0115F" }
				}
			},
			...options
		});

		this.translatedMapping = translatedMapping;
	}

	addData(extraInfo: ExtraInfo | undefined, trackPoints: TrackPoints): void {
		const translatedExtraInfo = extraInfo && Object.fromEntries(Object.entries(extraInfo).map(([k, v]) => [(this.translatedMapping as any)[k] ?? k, v]));

		const data = createGeoJsonForHeightGraph(translatedExtraInfo, trackPoints);

		if(this._container)
			super.addData(data);
		else
			this._data = data;
	}

	_internalMousemoveHandler(...args: any[]): void {
		super._internalMousemoveHandler(...args);

		// Hack: Replace distance, elevation, segment length kilometers/meters with configured unit
		const dist = this._distTspan.text().match(/(\d+(\.\d+)) km/);
		if (dist) {
			this._distTspan.text(` ${formatDistance(Number(dist[1]))}`);
		}
		const alt = this._altTspan.text().match(/(\d+(\.\d+)) m/);
		if (alt) {
			this._altTspan.text(` ${formatElevation(Number(alt[1]))}`);
		}
		const area = this._areaTspan.text().match(/(\d+(\.\d+)) km/);
		if (area) {
			this._areaTspan.text(` ${formatDistance(Number(area[1]))}`);
		}
	}

	_appendScales(): void {
		super._appendScales();

		// Hack: Replace distance/elevation kilometers/meters in x/y axis labels with configured unit.
		// Steps are still according to round numbers of kilometers/meters, but at least the units are right.
		this._xAxis.tickFormat((d: number) => formatDistance(d));
		this._yAxis.tickFormat((d: number) => formatElevation(d));
	}

	_prepareData(): void {
		super._prepareData();

		// Hack: Append the total distance for each result type to the legend
		for (let i = 0; i < this._categories.length; i++) {
			const category = this._categories[i];
			const featureCollection = this._data[i];
			category.legend = Object.fromEntries(Object.entries(category.legend).map(([k, v]: [any, any]) => [k, {
				...v,
				text: getI18n().t("heightgraph.label-with-total", { label: v.text, total: formatDistance(featureCollection.properties.distances[v.type]) })
			}]));
		}
	}

	_showMapMarker(...args: any[]): void {
		// Heightgraph renders the map marker (when hovering the heightgraph) to the hard-coded element .leaflet-overlay-pane svg

		// First, we need to initialize the renderer to make sure that the element is even there
		this._map.getRenderer(new Polyline([], { pane: this.options.mapMarkerPane }));

		// Then, we temporarily change class names to make the desired pane (our custom option mapMarkerPane) match the hard-coded class name
		if (this.options.mapMarkerPane) {
			const overlayPane = this._map.getPane("overlayPane");
			const overlayPaneClass = overlayPane.className;
			const mapMarkerPane = this._map.getPane(this.options.mapMarkerPane);
			const mapMarkerPaneClass = mapMarkerPane.className;

			overlayPane.classList.remove("leaflet-overlay-pane");
			mapMarkerPane.classList.add("leaflet-overlay-pane");

			try {
				super._showMapMarker(...args);
			} finally {
				overlayPane.className = overlayPaneClass;
				mapMarkerPane.className = mapMarkerPaneClass;
			}
		} else {
			super._showMapMarker(...args);
		}
	}

}