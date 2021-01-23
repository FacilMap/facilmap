import L, { FeatureGroup, Map, MarkerClusterGroup, MarkerClusterGroupOptions } from "leaflet";
import Socket from "facilmap-client";
import { PadData } from "facilmap-types";
import "leaflet.markercluster";

export default class MarkerCluster extends MarkerClusterGroup {

    options: MarkerClusterGroupOptions = {
        showCoverageOnHover: false,
        maxClusterRadius: 50
    };

    client: Socket;
    _maxClusterRadiusBkp: MarkerClusterGroupOptions['maxClusterRadius'];

    constructor(client: Socket, options: MarkerClusterGroupOptions) {
        super(options);

        this._maxClusterRadiusBkp = this.options.maxClusterRadius;
        this.options.maxClusterRadius = 0;

        this.client = client;
    }

    handlePadData = (padData: PadData) => {
        const isClusterEnabled = this._maxClusterRadiusBkp == null;

        if (padData.clusterMarkers && !isClusterEnabled) {
            this.options.maxClusterRadius = this._maxClusterRadiusBkp;
            this._maxClusterRadiusBkp = undefined;
            (this as any)._generateInitialClusters();
        } else if (!padData.clusterMarkers && isClusterEnabled) {
            this._maxClusterRadiusBkp = this.options.maxClusterRadius;
            this.options.maxClusterRadius = 0;
            (this as any)._generateInitialClusters();
        }
    }

    onAdd(map: Map): this {
        super.onAdd(map);

        this.client.on("padData", this.handlePadData);
        if (this.client.padData)
            this.handlePadData(this.client.padData);
        
        return this;
    }

    onRemove(map: Map): this {
        super.onRemove(map);
        
        this.client.removeListener("padData", this.handlePadData);
        
        return this;
    }

}
