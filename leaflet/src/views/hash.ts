import Client from 'facilmap-client';
import { numberKeys } from 'facilmap-utils';
import { Evented, Handler, latLng, LatLng, Map } from 'leaflet';
import { isEqual } from 'lodash';
import { defaultVisibleLayers, getVisibleLayers, setVisibleLayers } from '../layers';
import OverpassLayer from '../overpass/overpass-layer';
import { getOverpassPresets, OverpassPreset } from '../overpass/overpass-presets';
import { pointsEqual } from '../utils/leaflet';
import { decodeLegacyHash } from './legacyHash';
import { displayView, isAtView } from './views';

export interface HashQuery {
	query: string;
	center?: LatLng;
	zoom?: number;
}

export interface HashHandlerOptions {
	simulate?: boolean;
	overpassLayer?: OverpassLayer;
}

export default class HashHandler extends Handler {

	options: HashHandlerOptions;
	client: Client<any>;
	activeQuery?: HashQuery;
	_isActive = false;

	constructor(map: Map, client: Client<any>, options?: HashHandlerOptions) {
		super(map);
		this.client = client;
		this.options = {
			simulate: false,
			...options
		};
	}

	addHooks(): void {
		this._map.on("moveend", this.handleMapChange);
		this._map.on("layeradd", this.handleMapChange);
		this._map.on("layerremove", this.handleMapChange);
		this._map.on("fmFilter", this.handleMapChange);
		this._map.on("filter", this.handleMapChange);
		if (this.options.overpassLayer)
			this.options.overpassLayer.on("setQuery", this.handleMapChange);

		if (!this.options.simulate) {
			window.addEventListener("hashchange", this.handleHashChange);
			this.handleHashChange();
		}
	}

	removeHooks(): void {
		this._map.off("moveend", this.handleMapChange);
		this._map.off("layeradd", this.handleMapChange);
		this._map.off("layerremove", this.handleMapChange);
		this._map.off("fmFilter", this.handleMapChange);
		if (this.options.overpassLayer)
			this.options.overpassLayer.off("setQuery", this.handleMapChange);
		window.removeEventListener("hashchange", this.handleHashChange);
	}

	handleHashChange = (): void => {
		if (this._isActive)
			return;

		this.applyHash();
	}

	handleMapChange = (): void => {
		if (this._isActive || !this._map._loaded)
			return;

		const hash = this.getHash();
		this.fireEvent("fmHash", { hash });

		if (!this.options.simulate && location.hash != `#${hash}`) {
			this._isActive = true;
			setTimeout(() => {
				this._isActive = false;
			}, 0);
			location.replace(`#${hash}`);

			if(parent !== window) {
				parent.postMessage({
					type: "facilmap-hash",
					hash: hash
				}, "*");
			}
		}
	};

	/**
	 * Read the hash from location.hash and update the map view.
	 */
	applyHash(hash = location.hash): void {
		this._isActive = true;

		try {
			if(hash.indexOf('#') === 0) {
				hash = hash.substr(1);
			}

			this.fireEvent("fmHash", { hash });

			const viewMatch = hash.match(/^q=v(\d+)$/i);
			if(viewMatch && this.client.views[viewMatch[1] as any]) {
				displayView(this._map, this.client.views[viewMatch[1] as any]);
				return;
			}

			let args;
			if(hash.indexOf("=") != -1 && hash.indexOf("/") == -1)
				args = decodeLegacyHash(hash);
			else
				args = hash.split("/").map(decodeURIComponentTolerantly);

			if (args.length < 3)
				return;

			// This gets called just in L.Hash.update(), so we can already add/remove the layers here

			const layers = args[3]?.split("-");
			if(layers && layers.length > 0) {
				setVisibleLayers(this._map, { baseLayer: layers[0], overlays: layers.slice(1).filter((layer) => !layer.startsWith("O_") && !layer.startsWith("o_")) });
			}

			if (this.options.overpassLayer) {
				let query: string | OverpassPreset[] | undefined = undefined;
				for (const layer of layers) {
					if (layer.startsWith("o_"))
						query = getOverpassPresets(layer.substr(2).split("_"));
					else if (layer.startsWith("O_"))
						query = atob(layer.substr(2)).replace(/\./g, '+').replace(/_/g, '/');
				}
				this.options.overpassLayer.setQuery(query);
			}

			this.fire("fmQueryChange", { query: args[4], zoom: args[0] == null });

			this._map.setFmFilter(args[5]);

			const zoom = parseInt(args[0], 10);
			const lat = parseFloat(args[1]);
			const lon = parseFloat(args[2]);
			if (!isNaN(lat) && !isNaN(lon) && !isNaN(zoom))
				this._map.setView(latLng(lat, lon), zoom, { animate: false });
		} finally {
			this._isActive = false;

			this.handleMapChange();
		}
	}

	setQuery(query?: HashQuery): void {
		this.activeQuery = query;
		this.handleMapChange();
	}

	getHash(): string {
		let result: string | undefined;

		const visibleLayers = getVisibleLayers(this._map);
		const layerKeys = [visibleLayers.baseLayer, ...visibleLayers.overlays];

		if (this.options.overpassLayer && !this.options.overpassLayer.isEmpty()) {
			const query = this.options.overpassLayer.getQuery()!;
			if (typeof query == "string")
				layerKeys.push(`O_${btoa(query).replace(/\+/g, '.').replace(/\//g, '_').replace(/=+$/g, '')}`);
			else
				layerKeys.push(`o_${query.map((q) => q.key).join("_")}`);
		}

		const additionalParts = [ layerKeys.join("-") ];

		if (this.activeQuery) {
			additionalParts.push(this.activeQuery.query);
		} else if (this._map.fmFilter) {
			additionalParts.push("");
		}

		if (this._map.fmFilter) {
			additionalParts.push(this._map.fmFilter);
		}

		if (this.activeQuery && !this._map.fmFilter && isEqual(visibleLayers, defaultVisibleLayers) && this.activeQuery.zoom != null && this.activeQuery.center != null && this._map.getZoom() == this.activeQuery.zoom && pointsEqual(this._map.getCenter(), this.activeQuery.center, this._map, this.activeQuery.zoom)) {
			result = "q=" + encodeURIComponent(this.activeQuery.query);
		} else if(!this.activeQuery) {
			// Check if we have a saved view open
			const defaultView = (this.client.padData && this.client.padData.defaultViewId && this.client.views[this.client.padData.defaultViewId]);
			if(isAtView(this._map, defaultView || undefined))
				result = "";
			else {
				for(const viewId of numberKeys(this.client.views)) {
					if(isAtView(this._map, this.client.views[viewId])) {
						result = `q=v${encodeURIComponent(viewId)}`;
						break;
					}
				}
			}
		}

		if (result == null) {
			const center = this._map.getCenter();
			const zoom = this._map.getZoom();
			const precision = Math.max(0, Math.ceil(Math.log(zoom) / Math.LN2));

			result = [
				zoom,
				center.lat.toFixed(precision),
				center.lng.toFixed(precision),
				...additionalParts
			].map(encodeURIComponent).join("/");
		}

		return result;
	};

}

// eslint-disable-next-line no-redeclare
export default interface HashHandler extends Evented {}
Object.assign(HashHandler.prototype, Evented.prototype);

export function decodeURIComponentTolerantly(str: string): string {
	try {
		return decodeURIComponent(str.replace(/\+/g, ' '));
	} catch(e) {
		return str;
	}
}