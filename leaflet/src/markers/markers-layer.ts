import type Client from "facilmap-client";
import type { ID, Marker, ObjectWithId, Type } from "facilmap-types";
import { Map as LeafletMap } from "leaflet";
import { tooltipOptions } from "../utils/leaflet";
import { numberKeys, quoteHtml } from "facilmap-utils";
import MarkerCluster, { type MarkerClusterOptions } from "./marker-cluster";
import MarkerLayer from "./marker-layer";

export interface MarkersLayerOptions extends MarkerClusterOptions {
}

export default class MarkersLayer extends MarkerCluster {

	declare options: MarkersLayerOptions;
	protected markersById: Record<string, MarkerLayer> = {};
	protected highlightedMarkerIds = new Set<ID>();
	protected filterResults = new Map<ID, boolean>();

	/** The position of these markers will not be touched until they are unlocked again. */
	protected lockedMarkerIds = new Set<ID>();

	constructor(client: Client, options?: MarkersLayerOptions) {
		super(client, options);
	}

	onAdd(map: LeafletMap): this {
		super.onAdd(map);

		this.client.on("marker", this.handleMarker);
		this.client.on("deleteMarker", this.handleDeleteMarker);
		this.client.on("type", this.handleType);

		for (const markerId of numberKeys(this.client.markers)) {
			this.handleMarker(this.client.markers[markerId]);
		}

		map.on("fmFilter", this.handleFilter);

		return this;
	}

	onRemove(map: LeafletMap): this {
		super.onRemove(map);

		this.client.removeListener("marker", this.handleMarker);
		this.client.removeListener("deleteMarker", this.handleDeleteMarker);
		this.client.removeListener("type", this.handleType);

		map.off("fmFilter", this.handleFilter);

		return this;
	}

	protected recalculateFilter(marker: Marker): void {
		this.filterResults.set(marker.id, this._map.fmFilterFunc(marker, this.client.types[marker.typeId]));
	}

	protected shouldShowMarker(marker: Marker): boolean {
		return !!this.filterResults.get(marker.id);
	}

	protected handleMarker = (marker: Marker): void => {
		this.recalculateFilter(marker);
		if(this.shouldShowMarker(marker))
			this._addMarker(marker);
		else
			this._deleteMarker(marker);
	};

	protected handleDeleteMarker = (data: ObjectWithId): void => {
		this._deleteMarker(data);
		this.filterResults.delete(data.id);
	};

	protected handleType = (type: Type): void => {
		for (const markerId of numberKeys(this.client.markers)) {
			if (this.client.markers[markerId].typeId === type.id) {
				this.recalculateFilter(this.client.markers[markerId]);
			}
		}
	};

	protected handleFilter = (): void => {
		for(const markerId of numberKeys(this.client.markers)) {
			this.recalculateFilter(this.client.markers[markerId]);
			if (!this.lockedMarkerIds.has(markerId)) {
				const show = this.shouldShowMarker(this.client.markers[markerId]);
				if(this.markersById[markerId] && !show)
					this._deleteMarker(this.client.markers[markerId]);
				else if(!this.markersById[markerId] && show)
					this._addMarker(this.client.markers[markerId]);
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
		if (this._map && this.client.markers[id])
			this.handleMarker(this.client.markers[id]);
	}

	unhighlightMarker(id: ID): void {
		this.highlightedMarkerIds.delete(id);
		if (this._map && this.client.markers[id])
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

		// Remove marker from cluster and add directly to map
		const markerLayer = this.getLayerByMarkerId(id);
		if (markerLayer) {
			this.removeLayer(markerLayer);
			this._map.addLayer(markerLayer);
		}
	}

	/**
	 * Unlock a marker previously locked using lockMarker(). The current position and filter is applied to the marker.
	 */
	unlockMarker(id: ID): void {
		this.lockedMarkerIds.delete(id);

		// Move marker back into cluster
		const markerLayer = this.getLayerByMarkerId(id);
		if (markerLayer) {
			this._map.removeLayer(markerLayer);
			this.addLayer(markerLayer);
		}

		if (this.shouldShowMarker(this.client.markers[id]))
			this._addMarker(this.client.markers[id]);
		else
			this._deleteMarker(this.client.markers[id]);
	}

	getLayerByMarkerId(markerId: ID): MarkerLayer | undefined {
		return this.markersById[markerId];
	}

	protected _addMarker(marker: Marker): void {
		const updatePos = !this.markersById[marker.id] || !this.lockedMarkerIds.has(marker.id);

		if(!this.markersById[marker.id]) {
			const layer = new MarkerLayer([ 0, 0 ]);
			this.markersById[marker.id] = layer;
			this.addLayer(layer);
		}

		(this.markersById[marker.id] as any).marker = marker;

		const highlight = this.highlightedMarkerIds.has(marker.id);

		if (updatePos && !this.markersById[marker.id].getLatLng().equals([ marker.lat, marker.lon ])) {
			this.markersById[marker.id].setLatLng([ marker.lat, marker.lon ]);
		}

		this.markersById[marker.id].setStyle({ marker, highlight, raised: highlight });

		if (marker.name) {
			const quoted = quoteHtml(marker.name);
			if (!this.markersById[marker.id]._tooltip) {
				this.markersById[marker.id].bindTooltip(quoted, { ...tooltipOptions, offset: [ 20, -15 ] });
			} else if (this.markersById[marker.id]._tooltip!.getContent() !== quoted) {
				this.markersById[marker.id].setTooltipContent(quoted);
			}
		} else if (this.markersById[marker.id]._tooltip) {
			this.markersById[marker.id].unbindTooltip();
		}
	}

	protected _deleteMarker(marker: ObjectWithId): void {
		if(!this.markersById[marker.id])
			return;

		this.removeLayer(this.markersById[marker.id]);
		delete this.markersById[marker.id];
	}

}