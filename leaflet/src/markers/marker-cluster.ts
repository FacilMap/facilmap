import { Map, MarkerClusterGroup, type MarkerClusterGroupOptions } from "leaflet";
import type Client from "facilmap-client";
import type { PadData } from "facilmap-types";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

export interface MarkerClusterOptions extends MarkerClusterGroupOptions {
}

export default class MarkerCluster extends MarkerClusterGroup {

	protected client: Client;
	protected _maxClusterRadiusBkp: MarkerClusterOptions['maxClusterRadius'];

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

	protected handlePadData = (padData: PadData): void => {
		const isClusterEnabled = this._maxClusterRadiusBkp == null;

		if (!!padData.clusterMarkers !== isClusterEnabled) {
			if (padData.clusterMarkers) {
				this.options.maxClusterRadius = this._maxClusterRadiusBkp;
				this._maxClusterRadiusBkp = undefined;
			} else {
				this._maxClusterRadiusBkp = this.options.maxClusterRadius;
				this.options.maxClusterRadius = 0;
			}

			const layers = this.getLayers();
			this.clearLayers();
			this.addLayers(layers);
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
