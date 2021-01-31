import fm from '../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';

fm.app.factory("fmHighlightableLayers", function(fmUtils) {

	class GeoJSON extends L.GeoJSON {

		addData(geojson) {
			var features = Array.isArray(geojson) ? geojson : geojson.features,
			    i, len, feature;

			if (features) {
				for (i = 0, len = features.length; i < len; i++) {
					// only add this if geometry or geometries are set and not null
					feature = features[i];
					if (feature.geometries || feature.geometry || feature.features || feature.coordinates) {
						this.addData(feature);
					}
				}
				return this;
			}

			var options = this.options;

			if (options.filter && !options.filter(geojson)) { return this; }

			var layer = this.geometryToLayer(geojson, options);
			if (!layer) {
				return this;
			}
			layer.feature = L.GeoJSON.asFeature(geojson);

			layer.defaultOptions = layer.options;
			this.resetStyle(layer);

			if (options.onEachFeature) {
				options.onEachFeature(geojson, layer);
			}

			return this.addLayer(layer);
		}

		geometryToLayer(geojson, options) {
			var geometry = geojson.type === 'Feature' ? geojson.geometry : geojson,
			    coords = geometry ? geometry.coordinates : null,
			    layers = [],
			    _coordsToLatLng = options && options.coordsToLatLng || L.GeoJSON.coordsToLatLng,
			    latlng, latlngs, i, len;

			if (!coords && !geometry) {
				return null;
			}

			switch (geometry.type) {
				case 'Point':
					latlng = _coordsToLatLng(coords);
					return new fmHighlightableLayers.Marker(latlng, this.options.markerOptions);

				case 'MultiPoint':
					for (i = 0, len = coords.length; i < len; i++) {
						latlng = _coordsToLatLng(coords[i]);
						layers.push(new fmHighlightableLayers.Marker(latlng, this.options.markerOptions));
					}
					return new FeatureGroup(layers);

				case 'LineString':
				case 'MultiLineString':
					latlngs = L.GeoJSON.coordsToLatLngs(coords, geometry.type === 'LineString' ? 0 : 1, _coordsToLatLng);
					return new fmHighlightableLayers.Polyline(latlngs, this.options);

				case 'Polygon':
				case 'MultiPolygon':
					latlngs = L.GeoJSON.coordsToLatLngs(coords, geometry.type === 'Polygon' ? 1 : 2, _coordsToLatLng);
					return new fmHighlightableLayers.Polygon(latlngs, this.options);

				case 'GeometryCollection':
					for (i = 0, len = geometry.geometries.length; i < len; i++) {
						var layer = this.geometryToLayer({
							geometry: geometry.geometries[i],
							type: 'Feature',
							properties: geojson.properties
						}, options);

						if (layer) {
							layers.push(layer);
						}
					}
					return new L.FeatureGroup(layers);

				default:
					throw new Error('Invalid GeoJSON object.');
			}
		}

	}


	let fmHighlightableLayers = {
		Marker,
		Polygon,
		Polyline,
		GeoJSON
	};

	return fmHighlightableLayers;

});
