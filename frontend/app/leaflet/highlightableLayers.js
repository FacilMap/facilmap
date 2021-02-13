import fm from '../app';
import $ from 'jquery';
import L from 'leaflet';
import ng from 'angular';

fm.app.factory("fmHighlightableLayers", function(fmUtils) {

	


	let fmHighlightableLayers = {
		Marker,
		Polygon,
		Polyline,
		GeoJSON
	};

	return fmHighlightableLayers;

});
