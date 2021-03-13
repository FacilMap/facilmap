import { ID, SearchResult } from "facilmap-types";
import { DomEvent, Evented, Handler, LeafletEvent, Map } from "leaflet";
import { isEqual } from "lodash";
import { LinesLayer, MarkersLayer, SearchResultsLayer } from "facilmap-leaflet";

export type SelectedItem = {
	type: "marker" | "line";
	id: ID;
} | {
	type: "searchResult";
	result: SearchResult;
}

const allowedSiblings: Record<SelectedItem['type'], Array<SelectedItem['type']>> = {
	marker: ["marker", "line"],
	line: ["marker", "line"],
	searchResult: ["searchResult"]
};

function byType<T extends SelectedItem["type"]>(items: SelectedItem[], type: T): Array<SelectedItem & { type: T }> {
	return items.filter((i) => i.type === type) as any;
}

export default class SelectionHandler extends Handler {

	_selection: SelectedItem[] = [];

	_markersLayer: MarkersLayer;
	_linesLayer: LinesLayer;
	_searchResultsLayer: SearchResultsLayer;

	constructor(map: Map, markersLayer: MarkersLayer, linesLayer: LinesLayer, searchResultsLayer: SearchResultsLayer) {
		super(map);

		this._markersLayer = markersLayer;
		this._linesLayer = linesLayer;
		this._searchResultsLayer = searchResultsLayer;
	}

	addHooks(): void {
		this._markersLayer.on("click", this.handleClickMarker);
		this._linesLayer.on("click", this.handleClickLine);
		this._searchResultsLayer.on("click", this.handleClickSearchResult);
		this._map.on("click", this.handleClickMap);
	}

	removeHooks(): void {
		this._markersLayer.off("click", this.handleClickMarker);
		this._linesLayer.off("click", this.handleClickLine);
		this._searchResultsLayer.off("click", this.handleClickSearchResult);
		this._map.off("click", this.handleClickMap);
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
		this._searchResultsLayer.setHighlightedResults(new Set(
			byType(items, "searchResult").map((i) => i.result)
		));

		this.fire("fmChangeSelection", { open });
	}

	isSelected(item: SelectedItem): boolean {
		return this._selection.some((i) => isEqual(i, item));
	}

	selectItem(item: SelectedItem, open = false): void {
		if (!this.isSelected(item))
			this.setSelectedItems([...this._selection, item], open);
		else if (open)
			this.fire("fmChangeSelection", { open });
	}

	unselectItem(item: SelectedItem): void {
		this.setSelectedItems(this._selection.filter((i) => !isEqual(i, item)));
	}

	toggleItem(item: SelectedItem, open = false): void {
		if (this.isSelected(item))
			this.unselectItem(item);
		else if (!this._selection.some((i) => !allowedSiblings[item.type].includes(i.type)))
			this.selectItem(item, open);
	}

	handleClickItem(item: SelectedItem, e: LeafletEvent): void {
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
			this.handleClickItem({ type: "searchResult", result: e.propagatedFrom._fmSearchResult }, e);
	}

	handleClickMap = (e: LeafletEvent): void => {
		if (!(e.originalEvent as any).ctrlKey && !(e.originalEvent as any).shiftKey)
			this.setSelectedItems([]);
	}

}

export default interface HashHandler extends Evented {}
Object.assign(SelectionHandler.prototype, Evented.prototype);
