import { GeoJSON, Geometry, Feature } from "geojson";
import { FeatureGroup, GeoJSON as GeoJSONLayer, GeoJSONOptions, Layer, PathOptions } from "leaflet";
import { HighlightablePolygon, HighlightablePolyline } from "leaflet-highlightable-layers";
import MarkerLayer, { MarkerLayerOptions } from "../markers/marker-layer";

interface SearchResultGeoJSONOptions extends GeoJSONOptions {
	marker?: MarkerLayerOptions['marker'];
	pathOptions?: PathOptions;
	highlight?: boolean;
	raised?: boolean;
}

export default class SearchResultGeoJSON extends GeoJSONLayer {

	declare options: SearchResultGeoJSONOptions;

	constructor(geojson: GeoJSON, options?: SearchResultGeoJSONOptions) {
		super(geojson, options);
	}

	addData(geojson: GeoJSON): this {
		// GeoJSON.addData() does not support specifying a custom geometryToLayer function. Thus we are replicating its functionality here.

		if (Array.isArray(geojson) || 'features' in geojson) {
			for (const feature of Array.isArray(geojson) ? geojson : geojson.features) {
				if (feature.geometries || feature.geometry || feature.features || feature.coordinates) {
					this.addData(feature);
				}
			}
			return this;
		}

		if (this.options.filter && !this.options.filter(geojson as any))
			return this;

		const layer = this.geometryToLayer(geojson);
		if (!layer)
			return this;

		(layer as any).feature = GeoJSONLayer.asFeature(geojson);

		(layer as any).defaultOptions = layer.options;
		this.resetStyle(layer);

		if (this.options.onEachFeature)
			this.options.onEachFeature(geojson as any, layer);

		return this.addLayer(layer);
	}

	geometryToLayer(geojson: Geometry | Feature): Layer | undefined {
		const geometry = geojson.type === 'Feature' ? geojson.geometry : geojson;
		const _coordsToLatLng = this.options.coordsToLatLng || GeoJSONLayer.coordsToLatLng;

		if (!geometry)
			return;

		switch (geometry.type) {
			case 'Point':
				return new MarkerLayer(_coordsToLatLng(geometry.coordinates as any), {
					marker: this.options.marker,
					raised: this.options.raised,
					highlight: this.options.highlight
				});

			case 'MultiPoint':
				return new FeatureGroup(geometry.coordinates.map((coords) => (
					new MarkerLayer(_coordsToLatLng(coords as any), {
						marker: this.options.marker,
						raised: this.options.raised,
						highlight: this.options.highlight
					})
				)));

			case 'LineString':
			case 'MultiLineString':
				return new HighlightablePolyline(GeoJSONLayer.coordsToLatLngs(geometry.coordinates, geometry.type === 'LineString' ? 0 : 1, _coordsToLatLng), {
					raised: this.options.raised,
					opacity: this.options.highlight ? 1 : 0.35,
					...this.options.pathOptions
				});

			case 'Polygon':
			case 'MultiPolygon':
				return new HighlightablePolygon(GeoJSONLayer.coordsToLatLngs(geometry.coordinates, geometry.type === 'Polygon' ? 1 : 2, _coordsToLatLng), {
					raised: this.options.raised,
					opacity: this.options.highlight ? 1 : 0.35,
					...this.options.pathOptions
				});

			case 'GeometryCollection':
				return new FeatureGroup(geometry.geometries.map((g) => (
					this.geometryToLayer({
						geometry: g,
						type: 'Feature',
						properties: (geojson as any).properties
					})
				)).filter((l) => l) as Layer[]);

			default:
				throw new Error('Invalid GeoJSON object.');
		}
	}

}