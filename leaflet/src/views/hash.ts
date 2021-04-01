import Client from 'facilmap-client';
import { numberKeys } from 'facilmap-utils';
import L, { Evented, Handler, LatLng, Map } from 'leaflet';
import 'leaflet-hash';
import { isEqual } from 'lodash';
import { defaultVisibleLayers, getVisibleLayers, setVisibleLayers } from '../layers';
import { pointsEqual } from '../utils/leaflet';
import { decodeLegacyHash } from './legacyHash';
import { displayView, isAtView, UnsavedView } from './views';

export interface ParsedHash extends UnsavedView {
	center: LatLng;
	zoom: number;
	baseLayer: string;
	overlays: string[];
	query?: string;
	filter?: string;
}

export interface HashQuery {
	query: string;
	center?: LatLng;
	zoom?: number;
}

export default class HashHandler extends Handler {

	client: Client<any>;
	hash: any;
	activeQuery?: HashQuery;

	constructor(map: Map, client: Client<any>) {
		super(map);
		this.client = client;

		this.hash = Object.assign(new L.Hash(), {
			parseHash: this.parseHash,
			formatHash: this.formatHash
		});
	}

	addHooks(): void {
		this.hash.init(this._map);

		// hashControl calls hashControl.onHashChange(), which will run hashControl.update() with 100ms delay.
		// Call hashControl.update() right now so that the subsequent code can rely on the correct map view to be set.
		this.hash.update();
		clearTimeout(this.hash.changeTimeout);
		this.hash.changeTimeout = null;

		this._map.on("layeradd", this.updateHash);
		this._map.on("layerremove", this.updateHash);
		this._map.on("fmFilter", this.updateHash);
		this._map.on("filter", this.updateHash);
	}

	removeHooks(): void {
		this._map.off("layeradd", this.updateHash);
		this._map.off("layerremove", this.updateHash);
		this._map.off("fmFilter", this.updateHash);
		this.hash.removeFrom(this._map);
	}

	updateHash = (): void => {
		this.hash.onMapMove();
	};

	setQuery(query?: HashQuery): void {
		this.activeQuery = query;
		this.updateHash();
	}

	parseHash = (hash: string, noEmit = false): ParsedHash | false => {
		if(hash.indexOf('#') === 0) {
			hash = hash.substr(1);
		}

		this.fireEvent("fmHash", { hash });
	
		const viewMatch = hash.match(/^q=v(\d+)$/i);
		if(viewMatch && this.client.views[viewMatch[1] as any]) {
			displayView(this._map, this.client.views[viewMatch[1] as any]);
			return false;
		}
	
		let args;
		if(hash.indexOf("=") != -1 && hash.indexOf("/") == -1)
			args = decodeLegacyHash(hash);
		else
			args = hash.split("/").map(decodeURIComponentTolerantly);
	
		// This gets called just in L.Hash.update(), so we can already add/remove the layers here

		const layers = args[3]?.split("-");
		if(layers && layers.length > 0) {
			setVisibleLayers(this._map, { baseLayer: layers[0], overlays: layers.slice(1) });
		}

		this.fire("fmQueryChange", { query: args[4], zoom: args[0] == null });

		this._map.setFmFilter(args[5]);
	
		return L.Hash.parseHash(args.slice(0, 3).join("/"));
	};

	formatHash = (mapObj: Map): string => {
		let result: string | undefined;
	
		const visibleLayers = getVisibleLayers(mapObj);
	
		const additionalParts = [ [visibleLayers.baseLayer, ...visibleLayers.overlays].join("-") ];
		
		if (this.activeQuery) {
			additionalParts.push(this.activeQuery.query);
		} else if (mapObj.fmFilter) {
			additionalParts.push("");
		}

		if (mapObj.fmFilter) {
			additionalParts.push(mapObj.fmFilter);
		}

		if (this.activeQuery && !mapObj.fmFilter && isEqual(visibleLayers, defaultVisibleLayers) && this.activeQuery.zoom != null && this.activeQuery.center != null && mapObj.getZoom() == this.activeQuery.zoom && pointsEqual(mapObj.getCenter(), this.activeQuery.center, mapObj, this.activeQuery.zoom)) {
			result = "#q=" + encodeURIComponent(this.activeQuery.query);
		} else if(!this.activeQuery) {
			// Check if we have a saved view open
			const defaultView = (this.client.padData && this.client.padData.defaultViewId && this.client.views[this.client.padData.defaultViewId]);
			if(isAtView(this._map, defaultView || undefined))
				result = "#";
			else {
				for(const viewId of numberKeys(this.client.views)) {
					if(isAtView(this._map, this.client.views[viewId])) {
						result = `#q=v${encodeURIComponent(viewId)}`;
						break;
					}
				}
			}
		}
		
		if (!result) {
			result = L.Hash.formatHash(mapObj) + "/" + additionalParts.map(encodeURIComponent).join("/");
		}
	
		if(parent !== window) {
			parent.postMessage({
				type: "facilmap-hash",
				hash: result.replace(/^#/, "")
			}, "*");
		}

		this.fireEvent("fmHash", { hash: result.replace(/^#/, "") });
	
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