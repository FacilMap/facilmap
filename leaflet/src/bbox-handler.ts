import Socket from "facilmap-client";
import { Handler, Map } from "leaflet";
import { leafletToFmBbox } from "./utils/leaflet";

export default class BboxHandler extends Handler {

    client: Socket;

    constructor(map: Map, client: Socket) {
        super(map);
        this.client = client;
    }

    handleMoveEnd = () => {
        if (this.client.padId || this.client.route) {
            this.client.updateBbox(leafletToFmBbox(this._map.getBounds(), this._map.getZoom()));
        }
    }

    addHooks() {
        this._map.on("moveend", this.handleMoveEnd);
    }

    removeHooks() {
        this._map.off("moveend", this.handleMoveEnd);
    }
}