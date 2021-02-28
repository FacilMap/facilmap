import Socket from 'facilmap-client';
import { ID, Marker, ObjectWithId } from 'facilmap-types';
import { Map } from 'leaflet';
import { tooltipOptions } from '../utils/leaflet';
import { quoteHtml } from 'facilmap-utils';
import MarkerCluster, { MarkerClusterOptions } from './marker-cluster';
import MarkerLayer from './marker-layer';

export interface MarkersLayerOptions extends MarkerClusterOptions {
}

export default class MarkersLayer extends MarkerCluster {

	options!: MarkersLayerOptions;
	client: Socket;
	markersById: Record<string, MarkerLayer> = {};
	highlightedMarkerIds = new Set<ID>();

	constructor(client: Socket, options?: MarkersLayerOptions) {
		super(client, options);
		this.client = client;
	}

	onAdd(map: Map): this {
		super.onAdd(map);

		this.client.on("marker", this.handleMarker);
		this.client.on("deleteMarker", this.handleDeleteMarker);

		map.on("fmFilter", this.handleFilter);

		return this;
	}

	onRemove(map: Map): this {
		super.onRemove(map);

		this.client.removeListener("marker", this.handleMarker);
		this.client.removeListener("deleteMarker", this.handleDeleteMarker);

		map.off("fmFilter", this.handleFilter);

		return this;
	}

	handleMarker = (marker: Marker): void => {
		if(this._map.fmFilterFunc(marker))
			this._addMarker(marker);
	};

	handleDeleteMarker = (data: ObjectWithId): void => {
		this._deleteMarker(data);
	};

	handleFilter = (): void => {
		for(const i of Object.keys(this.client.markers) as any as Array<keyof Socket['markers']>) {
			const show = this._map.fmFilterFunc(this.client.markers[i]);
			if(this.markersById[i] && !show)
				this._deleteMarker(this.client.markers[i]);
			else if(!this.markersById[i] && show)
				this._addMarker(this.client.markers[i]);
		}
	};

	async showMarker(id: ID, zoom = false): Promise<void> {
		const marker = this.client.markers[id] || await this.client.getMarker({ id });
	
		if(zoom)
			this._map.flyTo([marker.lat, marker.lon], 15);

		this._addMarker(marker);
	}

	highlightMarker(id: ID): void {
		this.highlightedMarkerIds.add(id);
		if (this.client.markers[id])
			this.handleMarker(this.client.markers[id]);
	}

	unhighlightMarker(id: ID): void {
		this.highlightedMarkerIds.delete(id);
		if (this.client.markers[id])
			this.handleMarker(this.client.markers[id]);
	}

	setHighlightedMarkers(ids: Set<ID>): void {
		for (const id of this.highlightedMarkerIds) {
			if (!ids.has(id))
				this.unhighlightMarker(id);
		}

		for (const id of ids) {
			if (!this.highlightedMarkerIds.has(id))
				this.highlightMarker(id);
		}
	}

	_addMarker(marker: Marker): void {
		if(!this.markersById[marker.id]) {
			const layer = new MarkerLayer([ 0, 0 ]);
			this.markersById[marker.id] = layer;
			this.addLayer(layer);

			layer.bindTooltip("", { ...tooltipOptions, offset: [ 20, -15 ] });
			layer.on("tooltipopen", () => {
				this.markersById[marker.id].setTooltipContent(quoteHtml(this.client.markers[marker.id].name));
			});
		}

		(this.markersById[marker.id] as any).marker = marker;

		const highlight = this.highlightedMarkerIds.has(marker.id);

		this.markersById[marker.id]
			.setLatLng([ marker.lat, marker.lon ])
			.setStyle({
				marker,
				highlight,
				raised: highlight
			});
	}

	_deleteMarker(marker: ObjectWithId): void {
		if(!this.markersById[marker.id])
			return;

		this.removeLayer(this.markersById[marker.id]);
		delete this.markersById[marker.id];
	}

}