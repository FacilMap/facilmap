import { Colour, Shape, Symbol } from "facilmap-types";
import L, { LatLngExpression, LeafletMouseEvent, Map, Marker, MarkerOptions } from "leaflet";
import { ensureRequiredPanes, setLayerPane } from "../panes/panes";
import { createMarkerIcon } from "../utils/icons";

interface MarkerLayerOptions extends MarkerOptions {
    colour: Colour;
    size: number;
    symbol: Symbol;
    shape: Shape;
    padding?: number;
    highlight?: boolean;
    rise?: boolean;
}

class MarkerLayer extends Marker {

    options: MarkerLayerOptions = {
        riseOnHover: true
    } as MarkerLayerOptions;

    _fmDragging: boolean = false;
    _fmDraggingMouseEvent?: LeafletMouseEvent;
    _fmMouseOver: boolean = false;

    constructor(latLng: LatLngExpression, options: MarkerLayerOptions) {
        super(latLng, options);

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

    beforeAdd(map: Map) {
        ensureRequiredPanes(map);
        return this;
    }

    _initIcon() {
        this.options.icon = createMarkerIcon(this.options.colour, this.options.size, this.options.symbol, this.options.shape, this.options.padding, this.options.highlight);

        super._initIcon();

        this.setOpacity(this.options.highlight || this.options.rise || this._fmMouseOver ? 1 : 0.6);

        setLayerPane(this, this.options.highlight || this.options.rise ? "fmHighlightMarkerPane" : "markerPane");
    }

    setStyle(style: Partial<MarkerLayerOptions>) {
        L.Util.setOptions(this, style);
        if(this._map)
            this._initIcon();
        return this;
    }

}