import { Evented, LatLngBounds, Map } from "leaflet";
import { throttle } from "lodash";

export default class BoxSelection extends Map.BoxZoom {

	_ctrlKey = false;

	constructor(map: Map) {
		super(Object.assign(Object.create(map), {
			fire: (type: string) => {
				if (type == "boxzoomstart")
					this.fire("selectstart", { ctrlKey: this._ctrlKey });
				else if (type == "boxzoomend")
					this.fire("selectend");

				return map;
			},
			fitBounds: () => {
				return map;
			}
		}));
	}

	_onMouseDown(e: MouseEvent): void {
		this._ctrlKey = e.ctrlKey;
		super._onMouseDown(e);
	}

	_onMouseMove(e: MouseEvent): void {
		super._onMouseMove(e);

		this.fireSelect(new LatLngBounds(
			this._map.containerPointToLatLng(this._startPoint),
			this._map.containerPointToLatLng(this._point)
		));
	}

	fireSelect = throttle((bounds: LatLngBounds) => {
		this.fire("select", { bounds });
	}, 300);

}

// eslint-disable-next-line no-redeclare
export default interface BoxSelection extends Evented {}
Object.assign(BoxSelection.prototype, Evented.prototype);
