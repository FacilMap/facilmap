import "leaflet.heightgraph";
import { Control, Polyline } from "leaflet";
import "leaflet.heightgraph/src/L.Control.Heightgraph.css";
import "./heightgraph.scss";
import type { TrackPoints } from "facilmap-client";
import { type ExtraInfo } from "facilmap-types";
import type { FeatureCollection } from "geojson";
import { calculateDistance, formatDistance, formatElevation, getCurrentUnits, getTranslatedExtraInfoTypes, getTranslatedExtraInfoValues, trackSegment } from "facilmap-utils";
import { getI18n } from "./i18n";

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
			const segmentPosList = trackSegment(trackPoints, extraInfo[i][segment][0], extraInfo[i][segment][1]).filter((t) => t.ele != null);

			if (distances[extraInfo[i][segment][2]] == null)
				distances[extraInfo[i][segment][2]] = 0;
			distances[extraInfo[i][segment][2]] += calculateDistance(segmentPosList).distance;

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

export default class FmHeightgraph extends Control.Heightgraph {
	private translatedTypes: Record<string, string>;

	constructor(options?: any) {
		// Consume current units in constructor to mark it as a reactive dependency
		getCurrentUnits();

		const i18n = getI18n();

		const translatedTypes = getTranslatedExtraInfoTypes();

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
				...Object.fromEntries(Object.entries(getTranslatedExtraInfoValues()).map(([k, v]) => [translatedTypes[k], v]))
			},
			...options
		});

		this.translatedTypes = translatedTypes;
	}

	addData(extraInfo: ExtraInfo | undefined, trackPoints: TrackPoints): void {
		const translatedExtraInfo = extraInfo && Object.fromEntries(Object.entries(extraInfo).map(([k, v]) => [this.translatedTypes[k] ?? k, v]));

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