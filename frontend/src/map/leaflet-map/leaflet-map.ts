import WithRender from "./leaflet-map.vue";
import Vue from "vue";
import { Component, InjectReactive, ProvideReactive } from "vue-property-decorator";
import Client from 'facilmap-client';
import "./leaflet-map.scss";
import { InjectClient } from "../client/client";
import L, { Control, LatLng, Map } from "leaflet";
import "leaflet/dist/leaflet.css";
import { createSymbolHtml, displayView, getInitialView, getVisibleLayers, HashHandler, VisibleLayers } from "facilmap-leaflet";
import "leaflet.locatecontrol";
import "leaflet.locatecontrol/dist/L.Control.Locate.css";
import "leaflet-graphicscale";
import "leaflet-graphicscale/src/Leaflet.GraphicScale.scss";
import "leaflet-mouse-position";
import "leaflet-mouse-position/src/L.Control.MousePosition.css";
import $ from "jquery";

const MAP_COMPONENTS_KEY = "fm-map-components";
const MAP_CONTEXT_KEY = "fm-map-context";

export function InjectMapComponents() {
    return InjectReactive(MAP_COMPONENTS_KEY);
}

export function InjectMapContext() {
    return InjectReactive(MAP_CONTEXT_KEY);
}

function createButton(symbol: string, onClick: () => void): Control {
    return Object.assign(new Control(), {
        onAdd() {
            const div = document.createElement('div');
            div.className = "leaflet-bar";
            const a = document.createElement('a');
            a.href = "javascript:";
            a.innerHTML = createSymbolHtml("currentColor", "1.5em", symbol);
            a.addEventListener("click", (e) => {
                e.preventDefault();
                onClick();
            });
            div.appendChild(a);
            return div;
        }
    });
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
    showToolbox: boolean;
}

@WithRender
@Component({
    components: { }
})
export default class LeafletMap extends Vue {

    @InjectClient() client!: Client;

    @ProvideReactive(MAP_COMPONENTS_KEY) mapComponents!: MapComponents;
    @ProvideReactive(MAP_CONTEXT_KEY) mapContext: MapContext = null as any;

    isInFrame = (parent !== window);
    loaded = false;

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

        $(locateControl._container).find("a").append(createSymbolHtml("currentColor", "1.5em", "screenshot"));

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

        /* createButton("menu-hamburger", () => {
            this.mapContext.showToolbox = true;
        }).addTo(map); */

        this.mapComponents = {
            map,
            hashHandler
        };

        (async () => {
            if (!map._loaded) {
                try {
                    // Initial view was not set by hash handler
                    displayView(map, await getInitialView(this.client));
                } catch (error) {
                    console.error(error);
                    displayView(map);
                }
            }
            this.loaded = true;
        })();

        this.mapContext = {
            center: map._loaded ? map.getCenter() : L.latLng(0, 0),
            zoom: map._loaded ? map.getZoom() : 1,
            layers: getVisibleLayers(map),
            filter: map.fmFilter,
            hash: location.hash.replace(/^#/, ""),
            showToolbox: false
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