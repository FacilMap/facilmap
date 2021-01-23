import { View } from "facilmap-types";
import { fmToLeafletBbox, leafletToFmBbox, pointsEqual } from "./utils/leaflet";
import { Map } from "leaflet";
import { getVisibleLayers, setVisibleLayers } from "./layers";
import { isEqual } from "lodash";

export type UnsavedView = Omit<View, 'id' | 'padId' | 'name'>;

export function getCurrentView(map: Map, includeFilter = false): UnsavedView {
    var ret: UnsavedView = {
        ...leafletToFmBbox(map.getBounds()),
        ...getVisibleLayers(map)
    };

    if (includeFilter && map.fmFilter) {
        ret.filter = map.fmFilter;
    }

    return ret;
}

const DEFAULT_VIEW: UnsavedView = { top: -90, bottom: 90, left: -180, right: 180, baseLayer: undefined as any, layers: [] };

export function displayView(map: Map, view = DEFAULT_VIEW, _zoomFactor = 0): void {
    setVisibleLayers(map, view);

    const bounds = fmToLeafletBbox(view);

    try {
        map.getCenter(); // Throws exception if map not initialised
        map.flyTo(bounds.getCenter(), map.getBoundsZoom(bounds, view === DEFAULT_VIEW) + _zoomFactor);
    } catch(e) {
        map.setView(bounds.getCenter(), map.getBoundsZoom(bounds, view === DEFAULT_VIEW) + _zoomFactor);
    }

    map.setFmFilter(view.filter);
};

function isAtView(map: Map, view = DEFAULT_VIEW): boolean {
    try {
        map.getCenter();
    } catch(e) {
        return false;
    }

    const currentView = getCurrentView(map);
    const bounds = fmToLeafletBbox(view);

    return (
        currentView.baseLayer === view.baseLayer
        && isEqual(currentView.layers, view.layers)
        && map.getBoundsZoom(bounds, view === DEFAULT_VIEW) == map.getZoom()
        && pointsEqual(bounds.getCenter(), map.getCenter(), map)
        && ((!map.fmFilter && !view.filter) || (map.fmFilter == view.filter))
    );
};