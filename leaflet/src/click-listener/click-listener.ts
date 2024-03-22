import type { Point } from "facilmap-types";
import { DomEvent, Layer, type LeafletMouseEvent, Map } from "leaflet";
import "./click-listener.scss";

class TransparentLayer extends Layer {
	_el?: HTMLElement;

	onAdd(map: Map): this {
		if (!this._el) {
			this._el = document.createElement('div');
			this._el.className = "fm-clickHandler";
		}

		// We append this element to the map container, not to the layers pane, so that it doesn't get moved
		// around and always covers 100% of the map.
		map.getContainer().append(this._el);

		this.addInteractiveTarget(this._el);
		return this;
	}

	onRemove(map: Map): this {
		this._el!.parentNode!.removeChild(this._el!);
		this.removeInteractiveTarget(this._el!);
		return this;
	}
}

export type ClickListener = (point?: Point) => void;
export type MoveListener = (point: Point) => void;
export interface ClickListenerHandle {
	cancel(): void;
}

export function addClickListener(map: Map, listener: ClickListener, moveListener?: MoveListener): ClickListenerHandle {
	map.fire('fmInteractionStart');

	const transparentLayer = new TransparentLayer().addTo(map);

	const handleMove = (e: LeafletMouseEvent) => {
		moveListener?.({ lat: e.latlng.lat, lon: e.latlng.lng });
	};

	const handleClick = (e: LeafletMouseEvent) => {
		e.originalEvent.preventDefault();
		DomEvent.stopPropagation(e);
		finish({ lat: e.latlng.lat, lon: e.latlng.lng });
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.code === "Escape") {
			e.preventDefault();
			finish();
		}
	};

	const finish = (point?: Point) => {
		map.fire('fmInteractionEnd');

		transparentLayer.removeFrom(map).off("click", handleClick);

		if(moveListener)
			transparentLayer.off("mousemove", handleMove);

		document.removeEventListener("keydown", handleKeyDown);

		listener(point);
	};

	document.addEventListener("keydown", handleKeyDown);

	transparentLayer.addTo(map).on("click", handleClick);

	if(moveListener)
		transparentLayer.on("mousemove", handleMove);

	return {
		cancel: () => {
			finish();
		}
	};
}