import L from 'leaflet';
import * as Layers from "./layers";
import * as ClickListener from "./click-listener/click-listener";
import * as Views from "./views/views";
import BboxHandler from "./bbox-handler";
import "./filter/map-filter";
import Socket from "facilmap-client";
import * as leafletUtils from "./utils/leaflet";
import * as icons from "./utils/icons";
import * as filter from "./utils/filter";
import * as utils from "./utils/utils";
import MarkerCluster from "./markers/marker-cluster";
import MarkerLayer from "./markers/marker-layer";
import MarkersLayer from "./markers/markers-layer";
import HashHandler from "./views/hash";
import LinesLayer from "./lines/lines-layer";
import RouteLayer from "./lines/route-layer";
import SearchResultGeoJSON from "./search/search-result-geojson";
import SearchResultsLayer from "./search/search-results-layer";

const FacilMap = {
    BboxHandler,
    ClickListener,
    HashHandler,
    Layers,
    LinesLayer,
    MarkerCluster,
    MarkerLayer,
    MarkersLayer,
    RouteLayer,
    SearchResultGeoJSON,
    SearchResultsLayer,
    Socket,
    Utils: {
        leaflet: leafletUtils,
        icons,
        filter,
        utils
    },
    Views
};

type FacilMapType = typeof FacilMap;

declare module 'leaflet' {
    export let FacilMap: FacilMapType;
}

L.FacilMap = FacilMap;

export default FacilMap;
