import fm from '../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';

fm.app.factory("fmHighlightableLayers", function(fmUtils) {

	


	class Polyline extends L.Polyline {

		constructor(latLngs, options) {
			options = Object.assign({
				width: 7
			}, options);

			super(latLngs, options);

			this.lineLayer = new L.Polyline(latLngs, Object.assign({}, options, { interactive: false }));
			this.borderLayer = new L.Polyline(latLngs, Object.assign({}, options, { interactive: false }));
		}

		beforeAdd(map) {
			fmHighlightableLayers._prepareMap(map);
			return super.beforeAdd(...arguments);
		}

		onAdd() {
			super.onAdd(...arguments);

			this._map.addLayer(this.lineLayer);
			this._map.addLayer(this.borderLayer);

			this.setStyle({});
		}

		onRemove() {
			this._map.removeLayer(this.lineLayer);
			this._map.removeLayer(this.borderLayer);

			super.onRemove(...arguments);
		}

		_regenerateStyle() {
			let isBright = fmUtils.getBrightness(this.options.color.replace(/^#/, "")) > 0.7;

			// A black border makes the lines look thicker, thus we decrease the thickness to make them look the original size again
			this.lineLayer.options.weight = isBright ? Math.round(this.options.width / 1.6) : this.options.width;

			this.lineLayer.options.opacity = this.borderLayer.options.opacity = this.options.highlight ? 1 : 0.35;

			this.borderLayer.options.color = this.borderLayer.options.fillColor = isBright ? "#000000" : "#ffffff";
			this.borderLayer.options.weight = this.lineLayer.options.weight * 2;

			this.options.opacity = 0;
			this.options.weight = Math.max(20, this.borderLayer.options.weight);

			fmHighlightableLayers._updatePane(this, "fmAlmostOverPane");
			fmHighlightableLayers._updatePane(this.lineLayer, this.options.highlight || this.options.rise ? "fmHighlightPane" : "overlayPane");
			fmHighlightableLayers._updatePane(this.borderLayer, this.options.highlight || this.options.rise ? "fmHighlightShadowPane" : "fmShadowPane");
		}

		redraw() {
			this._regenerateStyle();
			super.redraw(...arguments);
			this.lineLayer.redraw();
			this.borderLayer.redraw();
			return this;
		}

		setStyle(style) {
			L.Util.setOptions(this, style);
			L.Util.setOptions(this.borderLayer, style);
			L.Util.setOptions(this.lineLayer, style);
			this._regenerateStyle();
			super.setStyle({});
			this.lineLayer.setStyle({});
			this.borderLayer.setStyle({});
			return this;
		}

		setLatLngs(latLngs) {
			super.setLatLngs(...arguments);
			this.lineLayer.setLatLngs(...arguments);
			this.borderLayer.setLatLngs(...arguments);
			return this;
		}

	}


	class Polygon extends L.Polygon {

		constructor(latLngs, options) {
			super(latLngs, options);

			this.borderLayer = new L.Polygon(latLngs, Object.assign({}, options, { interactive: false }));

			if(this.options.width == null)
				this.options.width = 3;
		}

		beforeAdd(map) {
			fmHighlightableLayers._prepareMap(map);
			return super.beforeAdd(...arguments);
		}

		onAdd() {
			super.onAdd(...arguments);
			this._map.addLayer(this.borderLayer);

			this.setStyle({});
		}

		onRemove() {
			this._map.removeLayer(this.borderLayer);
			super.onRemove(...arguments);
		}

		_regenerateStyle() {
			let isBright = fmUtils.getBrightness(this.options.color.replace(/^#/, "")) > 0.7;

			// A black border makes the lines look thicker, thus we decrease the thickness to make them look the original size again
			this.options.weight = isBright ? Math.round(this.options.width / 1.6) : this.options.width;

			this.options.opacity = this.borderLayer.options.opacity = this.options.highlight ? 1 : 0.35;

			this.borderLayer.options.color = this.borderLayer.options.fillColor = isBright ? "#000000" : "#ffffff";
			this.borderLayer.options.weight = this.options.weight * 2;
			this.borderLayer.options.fill = this.options.highlight;

			fmHighlightableLayers._updatePane(this, this.options.highlight || this.options.rise ? "fmHighlightPane" : "overlayPane");
			fmHighlightableLayers._updatePane(this.borderLayer, this.options.highlight || this.options.rise ? "fmHighlightShadowPane" : "fmShadowPane");
		}

		redraw() {
			this._regenerateStyle();
			super.redraw(...arguments);
			this.borderLayer.redraw();
			return this;
		}

		setStyle(style) {
			L.Util.setOptions(this, style);
			L.Util.setOptions(this.borderLayer, style);
			this._regenerateStyle();
			super.setStyle({});
			this.borderLayer.setStyle({});
			return this;
		}

		setLatLngs(latLngs) {
			super.setLatLngs(...arguments);
			this.borderLayer.setLatLngs(...arguments);
			return this;
		}

	}


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
