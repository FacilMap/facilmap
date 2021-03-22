import { ID, SearchResult } from "facilmap-types";
import { DomEvent, Evented, Handler, LeafletEvent, Map, Util } from "leaflet";
import { LinesLayer, MarkersLayer, SearchResultsLayer } from "facilmap-leaflet";

export type SelectedItem = {
	type: "marker" | "line";
	id: ID;
} | {
	type: "searchResult";
	result: SearchResult;
	layerId: number;
};

function isAllowedSibling(a: SelectedItem, b: SelectedItem) {
	if (["marker", "line"].includes(a.type) && ["marker", "line"].includes(b.type))
		return true;
	else if (a.type == "searchResult" && b.type == "searchResult")
		return a.layerId == b.layerId;
	else
		return false;
}

function byType<T extends SelectedItem["type"]>(items: SelectedItem[], type: T): Array<SelectedItem & { type: T }> {
	return items.filter((i) => i.type === type) as any;
}

function isSame(a: SelectedItem, b: SelectedItem): boolean {
	if ((a.type == "marker" && b.type == "marker") || (a.type == "line" && b.type == "line"))
		return a.id == b.id;
	else if (a.type == "searchResult" && b.type == "searchResult")
		return a.result === b.result;
	else
		return false;
}

export default class SelectionHandler extends Handler {

	_selection: SelectedItem[] = [];

	_markersLayer: MarkersLayer;
	_linesLayer: LinesLayer;
	_searchResultLayers: SearchResultsLayer[];

	_mapFocusTime: number | undefined = undefined;
	_mapInteraction: number = 0;

	constructor(map: Map, markersLayer: MarkersLayer, linesLayer: LinesLayer, searchResultsLayer: SearchResultsLayer) {
		super(map);

		this._markersLayer = markersLayer;
		this._linesLayer = linesLayer;
		this._searchResultLayers = [searchResultsLayer];
	}

	addHooks(): void {
		this._markersLayer.on("click", this.handleClickMarker);
		this._linesLayer.on("click", this.handleClickLine);
		for (const layer of this._searchResultLayers)
			layer.on("click", this.handleClickSearchResult);
		this._map.on("click", this.handleClickMap);
		this._map.on("fmInteractionStart", this.handleMapInteractionStart);
		this._map.on("fmInteractionEnd", this.handleMapInteractionEnd);
		this._map.getContainer().addEventListener("focusin", this.handleMapFocusIn);
		this._map.getContainer().addEventListener("focusout", this.handleMapFocusOut);
	}

	removeHooks(): void {
		this._markersLayer.off("click", this.handleClickMarker);
		this._linesLayer.off("click", this.handleClickLine);
		for (const layer of this._searchResultLayers)
			layer.off("click", this.handleClickSearchResult);
		this._map.off("click", this.handleClickMap);
		this._map.off("fmInteractionStart", this.handleMapInteractionStart);
		this._map.off("fmInteractionEnd", this.handleMapInteractionEnd);
		this._map.getContainer().removeEventListener("focusin", this.handleMapFocusIn);
		this._map.getContainer().removeEventListener("focusout", this.handleMapFocusOut);
	}

	addSearchResultLayer(layer: SearchResultsLayer): void {
		if (this._searchResultLayers.includes(layer))
			return;

		if (this._enabled)
			layer.on("click", this.handleClickSearchResult);

		this._searchResultLayers.push(layer);
	}

	removeSearchResultLayer(layer: SearchResultsLayer): void {
		const idx = this._searchResultLayers.indexOf(layer);
		if (idx == -1)
			return;
		
		layer.off("click", this.handleClickSearchResult);
		this._searchResultLayers.splice(idx, 1);

		const layerId = Util.stamp(layer);
		const without = this._selection.filter((item) => item.type != "searchResult" || item.layerId != layerId);
		if (without.length != this._selection.length)
			this.setSelectedItems(without);
	}

	getSelection(): SelectedItem[] {
		return this._selection;
	}

	setSelectedItems(items: SelectedItem[], open = false): void {
		this._selection = items;

		this._markersLayer.setHighlightedMarkers(new Set(
			byType(items, "marker").map((i) => i.id)
		));
		this._linesLayer.setHighlightedLines(new Set(
			byType(items, "line").map((i) => i.id)
		));
		for (const layer of this._searchResultLayers) {
			const layerId = Util.stamp(layer);
			layer.setHighlightedResults(new Set(
				byType(items, "searchResult").filter((i) => i.layerId == layerId).map((i) => i.result)
			));
		}

		this.fire("fmChangeSelection", { open });
	}

	isSelected(item: SelectedItem): boolean {
		return this._selection.some((i) => isSame(i, item));
	}

	selectItem(item: SelectedItem, open = false): void {
		if (!this.isSelected(item))
			this.setSelectedItems([...this._selection, item], open);
		else if (open)
			this.fire("fmChangeSelection", { open });
	}

	unselectItem(item: SelectedItem): void {
		this.setSelectedItems(this._selection.filter((i) => !isSame(i, item)));
	}

	toggleItem(item: SelectedItem, open = false): void {
		if (this.isSelected(item))
			this.unselectItem(item);
		else if (!this._selection.some((i) => !isAllowedSibling(item, i)))
			this.selectItem(item, open);
	}

	handleClickItem(item: SelectedItem, e: LeafletEvent): void {
		if (this._mapInteraction)
			return;

		DomEvent.stopPropagation(e);
		if ((e.originalEvent as any).ctrlKey || (e.originalEvent as any).shiftKey)
			this.toggleItem(item, true);
		else
			this.setSelectedItems([item], true);
	}

	handleClickMarker = (e: LeafletEvent): void => {
		if (e.propagatedFrom?.marker?.id)
			this.handleClickItem({ type: "marker", id: e.propagatedFrom.marker.id }, e);
	}

	handleClickLine = (e: LeafletEvent): void => {
		if (e.propagatedFrom?.line?.id)
			this.handleClickItem({ type: "line", id: e.propagatedFrom.line.id }, e);
	}

	handleClickSearchResult = (e: LeafletEvent): void => {
		if (e.propagatedFrom?._fmSearchResult)
			this.handleClickItem({ type: "searchResult", result: e.propagatedFrom._fmSearchResult, layerId: Util.stamp(e.target) }, e);
	}

	handleClickMap = (e: LeafletEvent): void => {
		if (this._mapInteraction)
			return;

		if (!(e.originalEvent as any).ctrlKey && !(e.originalEvent as any).shiftKey) {
			if (this._selection.length == 0) {
				// Focus event is fired before click event. Delay so that our click handlers knows whether the map was focused before it was clicked.
				if (this._mapFocusTime && Date.now() - this._mapFocusTime > 500)
					this.fire("fmMapClick", e);
			} else
				this.setSelectedItems([]);
		}
	}

	handleMapFocusIn = (): void => {
		this._mapFocusTime = Date.now();
	}

	handleMapFocusOut = (): void => {
		this._mapFocusTime = undefined;
	}

	handleMapInteractionStart = (): void => {
		this._mapInteraction++;
	}

	handleMapInteractionEnd = (): void => {
		this._mapInteraction--;
	}

}

export default interface HashHandler extends Evented {}
Object.assign(SelectionHandler.prototype, Evented.prototype);
