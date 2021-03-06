import WithRender from "./leaflet-map.vue";
import Vue from "vue";
import { Component, InjectReactive, ProvideReactive } from "vue-property-decorator";
import Client from 'facilmap-client';
import "./leaflet-map.scss";
import { InjectClient } from "../client/client";
import L, { LatLng, Map } from "leaflet";
import "leaflet/dist/leaflet.css";
import { BboxHandler, createSymbolHtml, displayView, getInitialView, getVisibleLayers, HashHandler, LinesLayer, MarkersLayer, RouteLayer, SearchResultsLayer, VisibleLayers } from "facilmap-leaflet";
import "leaflet.locatecontrol";
import "leaflet.locatecontrol/dist/L.Control.Locate.css";
import "leaflet-graphicscale";
import "leaflet-graphicscale/src/Leaflet.GraphicScale.scss";
import "leaflet-mouse-position";
import "leaflet-mouse-position/src/L.Control.MousePosition.css";
import $ from "jquery";
import { VueDecorator } from "vue-class-component";
import { SelectedItem } from "../selection/selection";

const MAP_COMPONENTS_KEY = "fm-map-components";
const MAP_CONTEXT_KEY = "fm-map-context";

export function InjectMapComponents(): VueDecorator {
    return InjectReactive(MAP_COMPONENTS_KEY);
}

export function InjectMapContext(): VueDecorator {
    return InjectReactive(MAP_CONTEXT_KEY);
}

/* function createButton(symbol: string, onClick: () => void): Control {
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
} */

export interface MapComponents {
    bboxHandler: BboxHandler;
    graphicScale: any;
    hashHandler: HashHandler;
    linesLayer: LinesLayer;
    locateControl: L.Control.Locate;
    map: Map;
    markersLayer: MarkersLayer;
    mousePosition: L.Control.MousePosition;
    routeLayer: RouteLayer;
    searchResultsLayer: SearchResultsLayer;
}

export interface MapContext {
    center: LatLng;
    zoom: number;
    layers: VisibleLayers;
    filter: string | undefined;
    hash: string;
    showToolbox: boolean;
    selection: SelectedItem[];
    interaction: boolean;
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
    interaction = 0;

    get selfUrl(): string {
        return `${location.origin}${location.pathname}${this.mapContext.hash ? `#${this.mapContext.hash}` : ''}`;
    }

    mounted(): void {
        const el = this.$el.querySelector(".fm-leaflet-map") as HTMLElement;
        const map = L.map(el);

        map._controlCorners.bottomcenter = L.DomUtil.create("div", "leaflet-bottom fm-leaflet-center", map._controlContainer);

        this.mapComponents = {
            bboxHandler: new BboxHandler(map, this.client).enable(),
            graphicScale: L.control.graphicScale({ fill: "hollow", position: "bottomcenter" }).addTo(map),
            hashHandler: new HashHandler(map, this.client).enable(),
            linesLayer: new LinesLayer(this.client).addTo(map),
            locateControl: L.control.locate({ flyTo: true, icon: "a", iconLoading: "a" }).addTo(map),
            map,
            markersLayer: new MarkersLayer(this.client).addTo(map),
            mousePosition: L.control.mousePosition({ emptyString: "0, 0", separator: ", ", position: "bottomright" }).addTo(map),
            routeLayer: new RouteLayer(this.client).addTo(map),
            searchResultsLayer: new SearchResultsLayer().addTo(map)
        };

        $(this.mapComponents.locateControl._container).find("a").append(createSymbolHtml("currentColor", "1.5em", "screenshot"));

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
            showToolbox: false,
            selection: [],
            interaction: false
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

        map.on("fmInteractionStart", () => {
            this.interaction++;
            this.mapContext.interaction = true;
        });

        map.on("fmInteractionEnd", () => {
            this.interaction--;
            this.mapContext.interaction = this.interaction > 0;
        });

        this.mapComponents.hashHandler.on("fmHash", (e: any) => {
            this.mapContext.hash = e.hash;
        });
    }

}