import { InjectionKey, Ref, inject, provide } from "vue";
import L, { Map } from "leaflet";
import "leaflet/dist/leaflet.css";
import { BboxHandler, HashHandler, LinesLayer, MarkersLayer, SearchResultsLayer, OverpassLayer } from "facilmap-leaflet";
import SelectionHandler from "./selection";
import "leaflet.locatecontrol";

export interface MapComponents {
	bboxHandler: BboxHandler;
	container: HTMLElement;
	graphicScale: any;
	hashHandler: HashHandler;
	linesLayer: LinesLayer;
	locateControl: L.Control.Locate;
	map: Map;
	markersLayer: MarkersLayer;
	mousePosition: L.Control.MousePosition;
	overpassLayer: OverpassLayer;
	searchResultsLayer: SearchResultsLayer;
	selectionHandler: SelectionHandler;
}

const mapComponentsInject = Symbol("mapComponentsInject") as InjectionKey<Ref<MapComponents | undefined>>;

export function provideMapComponents(mapComponents: Ref<MapComponents | undefined>): void {
	return provide(mapComponentsInject, mapComponents);
}

export function injectMapComponentsOptional(): Ref<MapComponents | undefined> | undefined {
	return inject(mapComponentsInject);
}

export function injectMapComponentsRequired(): Ref<MapComponents> {
	const mapComponents = injectMapComponentsOptional();
	if (!mapComponents || !mapComponents.value) {
		throw new Error("No map components injected.");
	}
	return mapComponents as Ref<MapComponents>;
}