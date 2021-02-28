import WithRender from "./leaflet-map.vue";
import Vue from "vue";
import { Component, Inject, InjectReactive, Provide, ProvideReactive } from "vue-property-decorator";
import Client from 'facilmap-client';
import "./leaflet-map.scss";
import { ClientContext, InjectClient, InjectClientContext } from "../client/client";
import L, { LatLng, Map } from "leaflet";
import "leaflet/dist/leaflet.css";
import { displayView, getInitialView, getVisibleLayers, HashHandler, setVisibleLayers, VisibleLayers } from "facilmap-leaflet";
import "leaflet.locatecontrol";
import "leaflet.locatecontrol/dist/L.Control.Locate.css";
import "leaflet-graphicscale";
import "leaflet-graphicscale/src/Leaflet.GraphicScale.scss";
import "leaflet-mouse-position";
import "leaflet-mouse-position/src/L.Control.MousePosition.css";

const MAP_COMPONENTS_KEY = "fm-map-components";
const MAP_CONTEXT_KEY = "fm-map-context";

export function InjectMapComponents() {
    return InjectReactive(MAP_COMPONENTS_KEY);
}

export function InjectMapContext() {
    return InjectReactive(MAP_CONTEXT_KEY);
}

export interface MapComponents {
    map: Map;
    hashHandler: HashHandler;
}

export interface MapContext {
    center: LatLng;
    zoom: number;
    layers: VisibleLayers;
    filter: string | undefined;
    hash: string;
}

@WithRender
@Component({
    components: { }
})
export default class LeafletMap extends Vue {

    @InjectClient() client!: Client;
    @InjectClientContext() clientContext!: ClientContext;

    @ProvideReactive(MAP_COMPONENTS_KEY) mapComponents!: MapComponents;
    @ProvideReactive(MAP_CONTEXT_KEY) mapContext: MapContext = null as any;

    isInFrame = (parent !== window);
    loaded = true;

    get selfUrl() {
        return `${location.origin}${location.pathname}${this.mapContext.hash ? `#${this.mapContext.hash}` : ''}`;
    }

    mounted() {
        const el = this.$el.querySelector(".fm-leaflet-map") as HTMLElement;
        const map = L.map(el);

        const hashHandler = new HashHandler(map, this.client).enable();

        map._controlCorners.bottomcenter = L.DomUtil.create("div", "leaflet-bottom fm-leaflet-center", map._controlContainer);

        let locateControl = L.control.locate({
            flyTo: true,
            icon: "a",
            iconLoading: "a"
        }).addTo(map);

        // $compile($('<fm-icon fm-icon="screenshot" alt="Locate"/>').appendTo($("a", locateControl._container)))($scope);

        L.control.mousePosition({
            emptyString: "0, 0",
            separator: ", ",
            position: "bottomright"
        }).addTo(map);

        L.control.graphicScale({
            fill: "hollow",
            position: "bottomcenter"
        }).addTo(map);

        this.mapComponents = {
            map,
            hashHandler
        };

        if (!map._loaded) {
            // Initial view was not set by hash handler
            getInitialView(this.client).then((view) => {
                displayView(map, view);
            }).catch((error) => {
                console.error(error);
                // TODO
            });
        }

        this.mapContext = {
            center: map._loaded ? map.getCenter() : L.latLng(0, 0),
            zoom: map._loaded ? map.getZoom() : 1,
            layers: getVisibleLayers(map),
            filter: map.fmFilter,
            hash: location.hash.replace(/^#/, "")
        };

        map.on("moveend", () => {
            this.mapContext.center = map.getCenter();
            this.mapContext.zoom = map.getZoom();
        });
        
        map.on("fmFilter", () => {
            this.mapContext.filter = map.fmFilter;
        });

        map.on("layeradd layerremove", () => {
            this.mapContext.layers = getVisibleLayers(map);
        });

        hashHandler.on("fmHash", (e: any) => {
            this.mapContext.hash = e.hash;
        });
    }

}