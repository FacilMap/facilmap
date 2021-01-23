import { Layer, Map } from "leaflet";
import "./panes.scss";

const requiredPanes = [ "fmHighlightMarkerPane", "fmHighlightShadowPane", "fmHighlightPane", "fmShadowPane", "fmAlmostOverPane" ];

declare module "leaflet" {
    interface Map {
        _fmPanesPrepared?: boolean;
    }
}

export function ensureRequiredPanes(map: Map) {
    if(map._fmPanesPrepared)
        return;

    for(let paneName of requiredPanes)
        map.createPane(paneName);

    map._fmPanesPrepared = true;
}

export function setLayerPane(layer: Layer, pane: string) {
    if(layer.options.pane == pane)
        return;

    layer.options.pane = pane;
    if(layer["_map"])
        layer["_map"].removeLayer(layer).addLayer(layer);
}