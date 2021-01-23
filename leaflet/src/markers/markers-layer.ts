import Socket from 'facilmap-client';
import { FeatureGroup, LayerOptions, Marker as MarkerLayer } from 'leaflet';

export interface MarkersLayerOptions extends LayerOptions {
}

/* export default class MarkersLayer extends FeatureGroup {

    client: Socket;
    markersById: Record<string, MarkerLayer>;

    constructor(client: Socket, options?: MarkersLayerOptions) {
        super([], options);
        this.client = client;
    }

    map.client.on("marker", function(data) {
        if(map.client.filterFunc(data))
            markersUi._addMarker(data);
    });

    map.client.on("deleteMarker", function(data) {
        markersUi._deleteMarker(data);
    });

    map.client.on("filter", function() {
        for(var i in map.client.markers) {
            var show = map.client.filterFunc(map.client.markers[i]);
            if(markersById[i] && !show)
                markersUi._deleteMarker(map.client.markers[i]);
            else if(!markersById[i] && show)
                markersUi._addMarker(map.client.markers[i]);
        }
    });

    map.mapEvents.$on("showObject", (event, id, zoom) => {
        let m = id.match(/^m(\d+)$/);
        if(m) {
            event.preventDefault();

            $q.resolve().then(() => {
                return map.client.markers[id] || map.client.getMarker({ id: m[1] });
            }).then(((marker) => {
                if(zoom)
                    map.map.flyTo([marker.lat, marker.lon], 15);

                markersUi._addMarker(marker);
                markersUi.showMarkerInfoBox(marker);
            }).fmWrapApply($rootScope)).catch((err) => {
                map.messages.showMessage("danger", err);
            });
        }
    });

    _addMarker : function(marker) {
        if(!markersById[marker.id]) {
            markersById[marker.id] = (new fmHighlightableLayers.Marker([ 0, 0 ])).addTo(map.markerCluster)
                .on("click", function(e) {
                    markersUi.showMarkerInfoBox(map.client.markers[marker.id] || marker);
                }.fmWrapApply($rootScope))
                .bindTooltip("", $.extend({}, map.tooltipOptions, { offset: [ 20, -15 ] }))
                .on("tooltipopen", function() {
                    markersById[marker.id].setTooltipContent(fmUtils.quoteHtml(map.client.markers[marker.id].name));
                });
        }

        markersById[marker.id]
            .setLatLng([ marker.lat, marker.lon ])
            .setStyle({
                colour: marker.colour,
                size: marker.size,
                symbol: marker.symbol,
                shape: marker.shape,
                highlight: openMarker && openMarker.id == marker.id
            });

        if(openMarker && openMarker.id == marker.id)
            markersUi.showMarkerInfoBox(marker);
    },
    _deleteMarker : function(marker) {
        if(!markersById[marker.id])
            return;

        if(openMarker && openMarker.id == marker.id) {
            openMarker.hide();
            openMarker = null;
        }

        markersById[marker.id].removeFrom(map.map);
        delete markersById[marker.id];
    },

} */