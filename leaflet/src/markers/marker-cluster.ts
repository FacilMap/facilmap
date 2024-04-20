import { Map, MarkerClusterGroup, type MarkerClusterGroupOptions } from "leaflet";
import type Client from "facilmap-client";
import type { MapData } from "facilmap-types";
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

	protected handleMapData = (mapData: MapData): void => {
		const isClusterEnabled = this._maxClusterRadiusBkp == null;

		if (!!mapData.clusterMarkers !== isClusterEnabled) {
			if (mapData.clusterMarkers) {
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

		this.client.on("padData", this.handleMapData);
		if (this.client.mapData)
			this.handleMapData(this.client.mapData);

		return this;
	}

	onRemove(map: Map): this {
		super.onRemove(map);

		this.client.removeListener("padData", this.handleMapData);

		return this;
	}

}
