import fm from '../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';
import 'leaflet-almostover';

fm.app.factory("fmHighlightableLayers", function(fmUtils) {

	class Marker extends L.Marker {

		constructor(latLng, options) {
			options = Object.assign({
				riseOnHover: true
			}, options);
			super(latLng, options);

			this.on("mouseover", () => {
				this._mouseover = true;
				this._initIcon();
			});
			this.on("mouseout", () => {
				this._mouseover = false;
				this._initIcon();
			});
		}

		onAdd() {
			fmHighlightableLayers._prepareMap(this._map);
			super.onAdd(...arguments);
		}

		_initIcon() {
			this.options.icon = fmUtils.createMarkerIcon(this.options.colour, this.options.size, this.options.symbol, this.options.shape, this.options.padding, this.options.highlight);

			super._initIcon(...arguments);

			this.setOpacity(this.options.highlight || this.options.rise || this._mouseover ? 1 : 0.6);

			fmHighlightableLayers._updatePane(this, this.options.highlight || this.options.rise ? "fmHighlightMarkerPane" : "markerPane");
		}

		setStyle(style) {
			L.Util.setOptions(this, style);
			this._initIcon();
			return this;
		}

	}


	class Polyline extends L.Polyline {

		constructor(latLngs, options) {
			super(latLngs, options);

			this.borderLayer = new L.Polyline(latLngs, Object.assign({}, options, { interactive: false }));
		}

		onAdd() {
			fmHighlightableLayers._prepareMap(this._map);
			super.onAdd(...arguments);

			this._map.addLayer(this.borderLayer);
			this._map.almostOver.addLayer(this);

			this._updateStyle();
		}

		onRemove() {
			this._map.almostOver.removeLayer(this);
			this._map.removeLayer(this.borderLayer);

			super.onRemove(...arguments);
		}

		_updateStyle() {
			this.options.opacity = this.borderLayer.options.opacity = this.options.highlight ? 1 : 0.35;
			this.borderLayer.options.weight = this.options.weight * 2;
			this.borderLayer.options.color = "#"+fmUtils.makeTextColour(this.options.color.replace(/^#/, ""));

			fmHighlightableLayers._updatePane(this, this.options.highlight || this.options.rise ? "fmHighlightPane" : "overlayPane");
			fmHighlightableLayers._updatePane(this.borderLayer, this.options.highlight || this.options.rise ? "fmHighlightShadowPane" : "fmShadowPane");
		}

		redraw() {
			this._updateStyle();
			super.redraw(...arguments);
			this.borderLayer.redraw();
			return this;
		}

		setStyle(style) {
			L.Util.setOptions(this, style);
			L.Util.setOptions(this.borderLayer, style);
			this._updateStyle();
			super.setStyle({});
			this.borderLayer.setStyle({});
			return this;
		}

		setLatLngs(latLngs) {
			super.setLatLngs(...arguments);
			this.borderLayer.setLatLngs(...arguments);
			return this;
		}

		fire(type, data, propagate) {
			// Ignore DOM mouse events, otherwise we get them double, once by DOM, once by almostOver
			if([ "mouseover", "mousemove", "mouseout" ].includes(type) && (!data.type || !data.type.startsWith("almost:")))
				return;

			return super.fire.apply(this, arguments);
		}

	}


	class Polygon extends L.Polygon {

		constructor(latLngs, options) {
			super(latLngs, options);

			this.borderLayer = new L.Polygon(latLngs, Object.assign({}, options, { interactive: false }));
		}

		onAdd() {
			fmHighlightableLayers._prepareMap(this._map);
			super.onAdd(...arguments);
			this._map.addLayer(this.borderLayer);

			this._updateStyle();
		}

		onRemove() {
			this._map.removeLayer(this.borderLayer);
			super.onRemove(...arguments);
		}

		_updateStyle() {
			this.borderLayer.options.fill = this.options.highlight;
			this.borderLayer.options.fillColor = "#"+fmUtils.makeTextColour(this.options.color.replace(/^#/, ""));
			return Polyline.prototype._updateStyle.apply(this, arguments);
		}

		redraw() {
			this._updateStyle();
			super.redraw(...arguments);
			this.borderLayer.redraw();
			return this;
		}

		setStyle(style) {
			L.Util.setOptions(this, style);
			L.Util.setOptions(this.borderLayer, style);
			this._updateStyle();
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
			    _coordsToLatLng = options && options.coordsToLatLng || L.GeoJSON.coordsToLatLng.coordsToLatLng,
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
		_prepareMap(map) {
			if(map._fmHighlightableLayersPrepared)
				return;

			for(let paneName of [ "fmHighlightMarkerPane", "fmHighlightShadowPane", "fmHighlightPane", "fmShadowPane" ])
				map.createPane(paneName);

			map.almostOver.options.distance = 10;

			map.on('almost:over', (e) => {
				e.layer.fire('mouseover', e, true);
				$(map.getContainer()).addClass("fm-almostover");
			});

			map.on('almost:out', (e) => {
				e.layer.fire('mouseout', e, true);
				$(map.getContainer()).removeClass("fm-almostover");
			});

			map.on('almost:click', (e) => {
				e.layer.fire('click', e, true);
			});

			map.on('almost:move', (e) => {
				e.layer.fire('mousemove', e, true);
			});

			map._fmHighlightableLayersPrepared = true;
		},

		_updatePane(layer, pane) {
			if(layer.options.pane == pane)
				return;

			layer.options.pane = pane;
			if(layer._map)
				layer._map.removeLayer(layer).addLayer(layer);
		},

		Marker,
		Polygon,
		Polyline,
		GeoJSON
	};

	return fmHighlightableLayers;

});
