import Client from 'facilmap-client';
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
	client: Client;
	markersById: Record<string, MarkerLayer> = {};
	highlightedMarkerIds = new Set<ID>();

	/** The position of these markers will not be touched until they are unlocked again. */
	lockedMarkerIds = new Set<ID>();

	constructor(client: Client, options?: MarkersLayerOptions) {
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
		for(const i of Object.keys(this.client.markers) as any as Array<keyof Client['markers']>) {
			if (!this.lockedMarkerIds.has(i)) {
				const show = this._map.fmFilterFunc(this.client.markers[i]);
				if(this.markersById[i] && !show)
					this._deleteMarker(this.client.markers[i]);
				else if(!this.markersById[i] && show)
					this._addMarker(this.client.markers[i]);
			}
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

	/**
	 * Ignore the position and any filter for this marker until it is unlocked again using unlockMarker().
	 * 
	 * While a marker is locked, any new position that is received from the server is ignored, the position of the marker layer is left untouched.
	 * If a filter is applied that would hide the marker, it is also ignored and the marker stays visible. Style updated to the marker are still
	 * applied.
	 * 
	 * The purpose of this is to allow the user to edit the position of a marker by dragging it around. Panning/zooming the map would update the
	 * bbox and the server might resend the marker. In this case we don't want the position to be reset while the user is dragging the marker.
	*/
	lockMarker(id: ID): void {
		this.lockedMarkerIds.add(id);
	}

	/**
	 * Unlock a marker previously locked using lockMarker(). The current position and filter is applied to the marker.
	 */
	unlockMarker(id: ID): void {
		this.lockedMarkerIds.delete(id);

		if (this._map.fmFilterFunc(this.client.markers[id]))
			this._addMarker(this.client.markers[id]);
		else
			this._deleteMarker(this.client.markers[id]);
	}

	_addMarker(marker: Marker): void {
		const updatePos = !this.markersById[marker.id] || !this.lockedMarkerIds.has(marker.id);

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

		if (updatePos)
			this.markersById[marker.id].setLatLng([ marker.lat, marker.lon ]);

		this.markersById[marker.id].setStyle({ marker, highlight, raised: highlight });
	}

	_deleteMarker(marker: ObjectWithId): void {
		if(!this.markersById[marker.id])
			return;

		this.removeLayer(this.markersById[marker.id]);
		delete this.markersById[marker.id];
	}

}