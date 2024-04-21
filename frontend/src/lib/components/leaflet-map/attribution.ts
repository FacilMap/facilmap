import { Control, DomEvent, DomUtil, Map, type ControlOptions } from "leaflet";

export interface AttributionControlOptions extends ControlOptions {
	prefix?: string;
}

// Like the attribution control from Leaflet, but has a simple update() method that can be called in reaction to language changes
export class AttributionControl extends Control {
	declare options: AttributionControlOptions;
	protected _map?: Map;

	constructor(options?: AttributionControlOptions) {
		super({
			position: 'bottomright',
			prefix: `<a href="https://leafletjs.com" target="_blank">Leaflet</a>`,
			...options
		});
	}

	onAdd(map: Map): HTMLElement {
		this._container = DomUtil.create('div', 'leaflet-control-attribution');
		DomEvent.disableClickPropagation(this._container);

		this.update();

		map.on("layeradd", this.update, this);
		map.on("layerremove", this.update, this);

		return this._container;
	}

	onRemove(map: Map): void {
		map.off("layeradd", this.update, this);
		map.off("layerremove", this.update, this);
	}

	update(): void {
		if (this._map) {
			this._container.innerHTML = [
				...(this.options.prefix ? [this.options.prefix] : []),
				...Object.values(this._map._layers).flatMap((layer) => {
					const attr = layer.getAttribution?.();
					return attr ? [attr] : [];
				})
			].join(" <span aria-hidden=\"true\">|</span> ");
		}
	}
}