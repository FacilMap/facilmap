import { Map, MarkerClusterGroup, type MarkerClusterGroupOptions } from "leaflet";
import { SocketClientStorage, isReactivePropertyUpdate, type ReactiveObjectUpdate } from "facilmap-client";
import type { MapSlug } from "facilmap-types";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

export interface MarkerClusterOptions extends MarkerClusterGroupOptions {
}

export default class MarkerCluster extends MarkerClusterGroup {

	protected clientStorage: SocketClientStorage;
	readonly mapSlug: MapSlug;
	protected _maxClusterRadiusBkp: MarkerClusterOptions['maxClusterRadius'];
	protected unsubscribeStorageUpdate: (() => void) | undefined = undefined;

	constructor(clientStorage: SocketClientStorage, mapSlug: MapSlug, options?: MarkerClusterOptions) {
		super({
			showCoverageOnHover: false,
			maxClusterRadius: 50,
			...options
		});

		this._maxClusterRadiusBkp = this.options.maxClusterRadius;
		this.options.maxClusterRadius = 0;

		this.clientStorage = clientStorage;
		this.mapSlug = mapSlug;
	}

	onAdd(map: Map): this {
		super.onAdd(map);

		this.unsubscribeStorageUpdate = this.clientStorage.reactiveObjectProvider.subscribe((update) => this.handleStorageUpdate(update));
		this.handleMapData();

		return this;
	}

	onRemove(map: Map): this {
		super.onRemove(map);

		this.unsubscribeStorageUpdate?.();
		this.unsubscribeStorageUpdate = undefined;

		return this;
	}

	protected handleStorageUpdate(update: ReactiveObjectUpdate): void {
		if (!this.clientStorage.maps[this.mapSlug]) {
			return;
		}

		if (isReactivePropertyUpdate(update, this.clientStorage.maps[this.mapSlug], "mapData")) {
			this.handleMapData();
		}
	}

	protected handleMapData(): void {
		const mapData = this.clientStorage.maps[this.mapSlug]?.mapData;
		if (!mapData) {
			return;
		}

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

}
