import L from 'leaflet';
import * as Layers from "./layers";
import * as ClickListener from "./click-listener/click-listener";
import * as Utils from "./utils/leaflet";
import * as Views from "./views";
import BboxHandler from "./bbox-handler";
import * as Filter from "./utils/filter";
import "./filter/map-filter";
import * as Icons from "./utils/icons";

const FacilMap = {
    BboxHandler,
    ClickListener,
    Filter,
    Layers,
    Markers: {
        Icons
    },
    Utils,
    Views
};

type FacilMapType = typeof FacilMap;

declare module 'leaflet' {
    export let FacilMap: FacilMapType;
}

L.FacilMap = FacilMap;

export default FacilMap;
