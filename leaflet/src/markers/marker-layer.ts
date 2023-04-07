import { Marker } from "facilmap-types";
import L, { LatLngExpression, LeafletMouseEvent, Map, Marker as LeafletMarker, MarkerOptions } from "leaflet";
import { getMarkerIcon } from "../utils/icons";
import { setLayerPane } from "leaflet-highlightable-layers";
import "./marker-layer.scss";

Map.addInitHook(function (this: Map) {
	this.createPane("fm-raised-marker");
});

export interface MarkerLayerOptions extends MarkerOptions {
	marker?: Partial<Marker> & Pick<Marker, 'colour' | 'size' | 'symbol' | 'shape'>;
	highlight?: boolean;
	raised?: boolean;
}

export default class MarkerLayer extends LeafletMarker {

	declare options: MarkerLayerOptions;

	_fmDragging: boolean = false;
	_fmDraggingMouseEvent?: LeafletMouseEvent;
	_fmMouseOver: boolean = false;

	constructor(latLng: LatLngExpression, options?: MarkerLayerOptions) {
		super(latLng, {
			riseOnHover: true,
			...options
		});

		this.on("dragstart", () => {
			this._fmDragging = true;
		});
		this.on("dragend", () => {
			this._fmDragging = false;

			// Some of our code re-renders the icon on mouseover/mouseout. This breaks dragging if it's in place.
			// So we delay those events to when dragging has ended.
			if(this._fmDraggingMouseEvent) {
				if(!this._fmMouseOver && this._fmDraggingMouseEvent.type == "mouseover")
					this.fire("fmMouseOver", this._fmDraggingMouseEvent);
				else if(this._fmMouseOver && this._fmDraggingMouseEvent.type == "mouseout")
					this.fire("fmMouseOut", this._fmDraggingMouseEvent);
				this._fmDraggingMouseEvent = undefined;
			}
		});

		this.on("mouseover", (e: LeafletMouseEvent) => {
			if(this._fmDragging)
				this._fmDraggingMouseEvent = e;
			else
				this.fire("fmMouseOver", e);
		});
		this.on("mouseout", (e: LeafletMouseEvent) => {
			if(this._fmDragging)
				this._fmDraggingMouseEvent = e;
			else
				this.fire("fmMouseOut", e);
		});

		this.on("fmMouseOver", () => {
			this._fmMouseOver = true;
			this.setStyle({});
		});
		this.on("fmMouseOut", () => {
			this._fmMouseOver = false;
			this.setStyle({});
		});
	}

	_initIcon(): void {
		if (this.options.marker)
			this.options.icon = getMarkerIcon(`#${this.options.marker.colour}`, this.options.marker.size, this.options.marker.symbol, this.options.marker.shape, this.options.highlight);

		super._initIcon();

		this.setOpacity(this.options.highlight || this.options.raised || this._fmMouseOver ? 1 : 0.6);

		setLayerPane(this, this.options.highlight || this.options.raised ? "fm-raised-marker" : "markerPane");
	}

	setStyle(style: Partial<MarkerLayerOptions>): this {
		L.Util.setOptions(this, style);
		if(this._map)
			this._initIcon();
		return this;
	}

}