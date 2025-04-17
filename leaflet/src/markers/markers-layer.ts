import { SocketClientStorage, isReactiveObjectUpdate, type ReactiveObjectUpdate } from "facilmap-client";
import type { DeepReadonly, ID, MapSlug, Marker, ObjectWithId, Type } from "facilmap-types";
import { Map as LeafletMap } from "leaflet";
import { tooltipOptions } from "../utils/leaflet";
import { numberEntries, quoteHtml } from "facilmap-utils";
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

	constructor(clientStorage: SocketClientStorage, mapSlug: MapSlug, options?: MarkersLayerOptions) {
		super(clientStorage, mapSlug, options);
	}

	onAdd(map: LeafletMap): this {
		super.onAdd(map);

		for (const marker of Object.values(this.clientStorage.maps[this.mapSlug]?.markers ?? {})) {
			this.handleMarker(marker);
		}

		map.on("fmFilter", this.handleFilter);

		return this;
	}

	onRemove(map: LeafletMap): this {
		super.onRemove(map);

		map.off("fmFilter", this.handleFilter);

		return this;
	}

	protected recalculateFilter(marker: Marker): void {
		this.filterResults.set(marker.id, this._map.fmFilterFunc(marker, this.clientStorage.maps[this.mapSlug]?.types[marker.typeId]));
	}

	protected shouldShowMarker(marker: Marker): boolean {
		return !!this.filterResults.get(marker.id);
	}

	protected handleStorageUpdate(update: ReactiveObjectUpdate): void {
		super.handleStorageUpdate(update);

		if (!this.clientStorage.maps[this.mapSlug]) {
			return;
		}

		if (isReactiveObjectUpdate(update, this.clientStorage.maps[this.mapSlug].markers)) {
			if (update.action === "set") {
				this.handleMarker(update.value);
			} else if (update.action === "delete") {
				this.handleDeleteMarker({ id: Number(update.key) });
			}
		} else if (isReactiveObjectUpdate(update, this.clientStorage.maps[this.mapSlug].types) && update.action === "set") {
			this.handleType(update.value);
		}
	}

	protected handleMarker(marker: DeepReadonly<Marker>): void {
		this.recalculateFilter(marker);
		if(this.shouldShowMarker(marker))
			this._addMarker(marker);
		else
			this._deleteMarker(marker);
	}

	protected handleDeleteMarker(data: ObjectWithId): void {
		this._deleteMarker(data);
		this.filterResults.delete(data.id);
	}

	protected handleType(type: DeepReadonly<Type>): void {
		for (const marker of Object.values(this.clientStorage.maps[this.mapSlug]?.markers ?? {})) {
			if (marker.typeId === type.id) {
				this.recalculateFilter(marker);
			}
		}
	}

	protected handleFilter = (): void => {
		for(const [markerId, marker] of numberEntries(this.clientStorage.maps[this.mapSlug]?.markers ?? {})) {
			this.recalculateFilter(marker);
			if (!this.lockedMarkerIds.has(markerId)) {
				const show = this.shouldShowMarker(marker);
				if(this.markersById[markerId] && !show)
					this._deleteMarker(marker);
				else if(!this.markersById[markerId] && show)
					this._addMarker(marker);
			}
		}
	};

	async showMarker(markerId: ID, zoom = false): Promise<void> {
		let marker = this.clientStorage.maps[this.mapSlug]?.markers[markerId];
		if (!marker) {
			marker = await this.clientStorage.client.getMarker(this.mapSlug, markerId);
			this.clientStorage.storeMarker(this.mapSlug, marker);
		}

		if(zoom)
			this._map.flyTo([marker.lat, marker.lon], 15);

		this._addMarker(marker);
	}

	highlightMarker(markerId: ID): void {
		this.highlightedMarkerIds.add(markerId);
		const marker = this.clientStorage.maps[this.mapSlug]?.markers[markerId];
		if (this._map && marker)
			this.handleMarker(marker);
	}

	unhighlightMarker(markerId: ID): void {
		this.highlightedMarkerIds.delete(markerId);
		const marker = this.clientStorage.maps[this.mapSlug]?.markers[markerId];
		if (this._map && marker)
			this.handleMarker(marker);
	}

	setHighlightedMarkers(markerIds: Set<ID>): void {
		for (const markerId of this.highlightedMarkerIds) {
			if (!markerIds.has(markerId))
				this.unhighlightMarker(markerId);
		}

		for (const markerId of markerIds) {
			if (!this.highlightedMarkerIds.has(markerId))
				this.highlightMarker(markerId);
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
	lockMarker(markerId: ID): void {
		this.lockedMarkerIds.add(markerId);

		// Remove marker from cluster and add directly to map
		const markerLayer = this.getLayerByMarkerId(markerId);
		if (markerLayer) {
			this.removeLayer(markerLayer);
			this._map.addLayer(markerLayer);
		}
	}

	/**
	 * Unlock a marker previously locked using lockMarker(). The current position and filter is applied to the marker.
	 */
	unlockMarker(markerId: ID): void {
		this.lockedMarkerIds.delete(markerId);

		// Move marker back into cluster
		const markerLayer = this.getLayerByMarkerId(markerId);
		if (markerLayer) {
			this._map.removeLayer(markerLayer);
			this.addLayer(markerLayer);
		}

		const marker = this.clientStorage.maps[this.mapSlug]?.markers[markerId];
		if (marker && this.shouldShowMarker(marker))
			this._addMarker(marker);
		else
			this._deleteMarker({ id: markerId });
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