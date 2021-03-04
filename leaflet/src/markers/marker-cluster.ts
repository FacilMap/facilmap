import { Map, MarkerClusterGroup, MarkerClusterGroupOptions } from "leaflet";
import Client from "facilmap-client";
import { PadData } from "facilmap-types";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

export interface MarkerClusterOptions extends MarkerClusterGroupOptions {
}

export default class MarkerCluster extends MarkerClusterGroup {

	client: Client;
	_maxClusterRadiusBkp: MarkerClusterOptions['maxClusterRadius'];

	constructor(client: Client, options?: MarkerClusterOptions) {
		super({
			showCoverageOnHover: false,
			maxClusterRadius: 50,
			...options
		});

		this._maxClusterRadiusBkp = this.options.maxClusterRadius;
		this.options.maxClusterRadius = 0;

		this.client = client;
	}

	handlePadData = (padData: PadData): void => {
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
