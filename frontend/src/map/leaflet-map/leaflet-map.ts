import WithRender from "./leaflet-map.vue";
import Vue from "vue";
import { Component, InjectReactive, ProvideReactive, Watch } from "vue-property-decorator";
import Client from 'facilmap-client';
import "./leaflet-map.scss";
import { InjectClient } from "../client/client";
import L, { LatLng, Map } from "leaflet";
import "leaflet/dist/leaflet.css";
import { BboxHandler, getSymbolHtml, displayView, getInitialView, getVisibleLayers, HashHandler, LinesLayer, MarkersLayer, RouteLayer, SearchResultsLayer, VisibleLayers, HashQuery } from "facilmap-leaflet";
import "leaflet.locatecontrol";
import "leaflet.locatecontrol/dist/L.Control.Locate.css";
import "leaflet-graphicscale";
import "leaflet-graphicscale/src/Leaflet.GraphicScale.scss";
import "leaflet-mouse-position";
import "leaflet-mouse-position/src/L.Control.MousePosition.css";
import $ from "jquery";
import { VueDecorator } from "vue-class-component";
import SelectionHandler, { SelectedItem } from "../../utils/selection";
import { FilterFunc } from "facilmap-utils";
import { getHashQuery } from "../../utils/zoom";
import context from "../context";

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
    selectionHandler: SelectionHandler;
}

export interface MapContext {
    center: LatLng;
    zoom: number;
    layers: VisibleLayers;
    filter: string | undefined;
    filterFunc: FilterFunc;
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

    get isNarrow(): boolean {
        return context.isNarrow;
    }

    get selfUrl(): string {
        return `${location.origin}${location.pathname}${this.mapContext.hash ? `#${this.mapContext.hash}` : ''}`;
    }

    mounted(): void {
        const el = this.$el.querySelector(".fm-leaflet-map") as HTMLElement;
        const map = L.map(el);

        map._controlCorners.bottomcenter = L.DomUtil.create("div", "leaflet-bottom fm-leaflet-center", map._controlContainer);

        const bboxHandler = new BboxHandler(map, this.client).enable();
        const graphicScale = L.control.graphicScale({ fill: "hollow", position: "bottomcenter" }).addTo(map);
        const hashHandler = new HashHandler(map, this.client).enable();
        const linesLayer = new LinesLayer(this.client).addTo(map);
        const locateControl = L.control.locate({ flyTo: true, icon: "a", iconLoading: "a" }).addTo(map);
        const markersLayer = new MarkersLayer(this.client).addTo(map);
        const mousePosition = L.control.mousePosition({ emptyString: "0, 0", separator: ", ", position: "bottomright" }).addTo(map);
        const routeLayer = new RouteLayer(this.client).addTo(map);
        const searchResultsLayer = new SearchResultsLayer().addTo(map);
        const selectionHandler = new SelectionHandler(map, markersLayer, linesLayer, searchResultsLayer).enable();

        this.mapComponents = { bboxHandler, graphicScale, hashHandler, linesLayer, locateControl, map,markersLayer, mousePosition, routeLayer, searchResultsLayer, selectionHandler };

        $(this.mapComponents.locateControl._container).find("a").append(getSymbolHtml("currentColor", "1.5em", "screenshot"));

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
            filterFunc: map.fmFilterFunc,
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
            this.mapContext.filterFunc = map.fmFilterFunc;
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

        hashHandler.on("fmHash", (e: any) => {
            this.mapContext.hash = e.hash;
        });

        selectionHandler.on("fmChangeSelection", (event: any) => {
            const selection = selectionHandler.getSelection();
            Vue.set(this.mapContext, "selection", selection);

            if (event.open) {
                setTimeout(() => {
                    this.$root.$emit("fm-open-selection", selection);
                }, 0);
            }
        });
    }

    get activeQuery(): HashQuery | undefined {
        if (!this.mapContext) // Not mounted yet
            return undefined;
        return getHashQuery(this.mapComponents.map, this.client, this.mapContext.selection);
    }

    @Watch("activeQuery")
    handleActiveQueryChange(query: HashQuery | undefined): void {
        this.mapComponents.hashHandler.setQuery(query);
    }

}