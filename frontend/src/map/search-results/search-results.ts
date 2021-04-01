import WithRender from "./search-results.vue";
import Vue from "vue";
import { Component, Prop, Watch } from "vue-property-decorator";
import { FindOnMapResult, ID, LineCreate, MarkerCreate, SearchResult, Type } from "facilmap-types";
import "./search-results.scss";
import Icon from "../ui/icon/icon";
import { Client, InjectClient, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import context from "../context";
import SearchResultInfo from "../search-result-info/search-result-info";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import { SelectedItem } from "../../utils/selection";
import { Point } from "geojson";
import { FileResult, FileResultObject } from "../../utils/files";
import { showErrorToast } from "../../utils/toasts";
import { lineStringToTrackPoints, mapSearchResultToType } from "./utils";
import { isFileResult, isLineResult, isMapResult, isMarkerResult } from "../../utils/search";
import { combineZoomDestinations, flyTo, getZoomDestinationForMapResult, getZoomDestinationForResults, getZoomDestinationForSearchResult } from "../../utils/zoom";
import { mapValues, pickBy, uniq } from "lodash";
import FormModal from "../ui/form-modal/form-modal";
import StringMap from "../../utils/string-map";

@WithRender
@Component({
	components: { FormModal, Icon, SearchResultInfo }
})
export default class SearchResults extends Vue {
	
	@InjectClient() client!: Client;
	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;

	@Prop({ type: Array }) searchResults?: Array<SearchResult | FileResult>;
	@Prop({ type: Array }) mapResults?: FindOnMapResult[];
	@Prop({ type: Number, required: true }) layerId!: number;
	/** When clicking a search result, union zoom to it. Normal zoom is done when clicking the zoom button. */
	@Prop({ type: Boolean, default: false }) unionZoom!: boolean;
	/** When clicking or selecting a search result, zoom to it. */
	@Prop({ type: Boolean, default: false }) autoZoom!: boolean;
	@Prop({ type: Object, default: () => ({}) }) customTypes!: FileResultObject["types"];

	activeTab = 0;

	get isNarrow(): boolean {
		return context.isNarrow;
	}

	get showZoom(): boolean {
		return !this.autoZoom || this.unionZoom;
	}

	get openResult(): SearchResult | FileResult | undefined {
		if (this.activeResults.length == 1 && !isMapResult(this.activeResults[0]))
			return this.activeResults[0];
		else
			return undefined;
	}

	get activeResults(): Array<SearchResult | FileResult | FindOnMapResult> {
		return [
			...(this.searchResults || []).filter((result) => this.mapContext.selection.some((item) => item.type == "searchResult" && item.result === result)),
			...(this.mapResults || []).filter((result) => {
				if (result.kind == "marker")
					return this.mapContext.selection.some((item) => item.type == "marker" && item.id == result.id);
				else if (result.kind == "line")
					return this.mapContext.selection.some((item) => item.type == "line" && item.id == result.id);
				else
					return false;
			})
		];
	}

	get isAllSelected(): boolean {
		return !this.searchResults?.some((result) => !this.activeResults.includes(result));
	}

	get activeSearchResults(): Array<SearchResult | FileResult> {
		return this.activeResults.filter((result) => !isMapResult(result)) as any;
	}

	get activeMarkerSearchResults(): Array<SearchResult | FileResult> {
		return this.activeSearchResults.filter((result) => isMarkerResult(result)) as any;
	}

	get activeLineSearchResults(): Array<SearchResult | FileResult> {
		return this.activeSearchResults.filter((result) => isLineResult(result)) as any;
	}

	get markerTypes(): Array<Type> {
		return Object.values(this.client.types).filter((type) => type.type == "marker");
	}

	get lineTypes(): Array<Type> {
		return Object.values(this.client.types).filter((type) => type.type == "line");
	}

	get hasCustomTypes(): boolean {
		return Object.keys(this.customTypes).length > 0;
	}

	closeResult(): void {
		this.activeTab = 0;
	}

	@Watch("openResult")
	handleOpenResultChange(openResult: SearchResult | FileResult | undefined): void {
		if (!openResult && this.activeTab != 0)
			this.activeTab = 0;
	}

	handleClick(result: SearchResult | FileResult | FindOnMapResult, event: MouseEvent): void {
		const toggle = event.ctrlKey || event.shiftKey;
		this.selectResult(result, toggle);

		if (this.autoZoom)
			this.zoomToSelectedResults(this.unionZoom || toggle);
	}

	zoomToSelectedResults(unionZoom: boolean): void {
		let dest = getZoomDestinationForResults(this.activeResults);
		if (dest && unionZoom)
			dest = combineZoomDestinations([dest, { bounds: this.mapComponents.map.getBounds() }]);
		if (dest)
			flyTo(this.mapComponents.map, dest);
	}

	zoomToResult(result: SearchResult | FileResult | FindOnMapResult): void {
		const dest = isMapResult(result) ? getZoomDestinationForMapResult(result) : getZoomDestinationForSearchResult(result);
		if (dest)
			flyTo(this.mapComponents.map, dest);
	}

	handleOpen(result: SearchResult | FileResult | FindOnMapResult, event: MouseEvent): void {
		this.selectResult(result, false);

		setTimeout(async () => {
			if (isMapResult(result)) {
				if (result.kind == "marker" && !this.client.markers[result.id])
					await this.client.getMarker({ id: result.id });
				this.mapContext.$emit("fm-search-box-show-tab", "fm-marker-info-tab", false);
			} else
				this.activeTab = 1;
		}, 0);
	}

	selectResult(result: SearchResult | FileResult | FindOnMapResult, toggle: boolean): void {
		const item: SelectedItem = isMapResult(result) ? { type: result.kind, id: result.id } : { type: "searchResult", result, layerId: this.layerId };
		if (toggle)
			this.mapComponents.selectionHandler.toggleItem(item);
		else
			this.mapComponents.selectionHandler.setSelectedItems([item]);
	}

	toggleSelectAll(): void {
		if (!this.searchResults)
			return;

		if (this.isAllSelected)
			this.mapComponents.selectionHandler.setSelectedItems([]);
		else {
			this.mapComponents.selectionHandler.setSelectedItems(this.searchResults.map((result) => ({ type: "searchResult", result, layerId: this.layerId })));

			if (this.autoZoom)
				this.zoomToSelectedResults(true);
		}
	}

	async _addToMap(data: Array<{ result: SearchResult | FileResult; type: Type }>): Promise<boolean> {
		this.$bvToast.hide("fm-search-result-info-add-error");

		try {
			const selection: SelectedItem[] = [];

			for (const { result, type } of data) {
				const obj: Partial<MarkerCreate<StringMap> & LineCreate<StringMap>> = {
					name: result.short_name
				};

				if("fmProperties" in result && result.fmProperties) { // Import GeoJSON
					Object.assign(obj, result.fmProperties);
					delete obj.typeId;
				} else {
					obj.data = mapSearchResultToType(result, type)
				}

				if(type.type == "marker") {
					const marker = await this.client.addMarker({
						...obj,
						lat: result.lat ?? (result.geojson as Point).coordinates[1],
						lon: result.lon ?? (result.geojson as Point).coordinates[0],
						typeId: type.id
					});

					selection.push({ type: "marker", id: marker.id });
				} else if(type.type == "line") {
					if (obj.routePoints) {
						const line = await this.client.addLine({
							...obj,
							routePoints: obj.routePoints,
							typeId: type.id
						});

						selection.push({ type: "line", id: line.id });
					} else {
						const trackPoints = lineStringToTrackPoints(result.geojson as any);
						const line = await this.client.addLine({
							...obj,
							typeId: type.id,
							routePoints: [trackPoints[0], trackPoints[trackPoints.length-1]],
							trackPoints: trackPoints,
							mode: "track"
						});

						selection.push({ type: "line", id: line.id });
					}
				}
			}

			this.mapComponents.selectionHandler.setSelectedItems(selection, true);

			return true;
		} catch (err) {
			showErrorToast(this, "fm-search-result-info-add-error", "Error adding to map", err);
			return false;
		}
	}

	async addToMap(results: Array<SearchResult | FileResult>, type: Type): Promise<void> {
		this._addToMap(results.map((result) => ({ result, type })));
	}

	useAs(result: SearchResult | FileResult, event: "fm-route-set-from" | "fm-route-add-via" | "fm-route-set-to"): void {
		if (isFileResult(result))
			this.mapContext.$emit(event, `${result.lat},${result.lon}`);
		else
			this.mapContext.$emit(event, result.short_name, this.searchResults, this.mapResults, result);
		this.mapContext.$emit("fm-search-box-show-tab", "fm-route-form-tab");
	}

	useAsFrom(result: SearchResult | FileResult): void {
		this.useAs(result, "fm-route-set-from");
	}

	useAsVia(result: SearchResult | FileResult): void {
		this.useAs(result, "fm-route-add-via");
	}

	useAsTo(result: SearchResult | FileResult): void {
		this.useAs(result, "fm-route-set-to");
	}


	////////////////////////////////////////////////////////////////////
	// Custom mapping
	////////////////////////////////////////////////////////////////////

	customMapping: Record<ID, false | string> = {};
	untypedMarkerMapping: false | string = false;
	untypedLineMapping: false | string = false;
	isCustomImportSaving = false;


	get activeFileResults(): Array<FileResult> {
		return this.activeResults.filter(isFileResult);
	}

	get activeFileResultsByType(): Record<ID, Array<FileResult>> {
		return mapValues(this.customTypes, (type, id) => this.activeFileResults.filter((result) => result.fmTypeId != null && `${result.fmTypeId}` == `${id}`));
	}

	get untypedMarkers(): Array<FileResult> {
		return this.activeFileResults.filter((result) => (result.fmTypeId == null || !this.customTypes[result.fmTypeId]) && isMarkerResult(result));
	}

	get untypedLines(): Array<FileResult> {
		return this.activeFileResults.filter((result) => (result.fmTypeId == null || !this.customTypes[result.fmTypeId]) && isLineResult(result));
	}

	get customMappingOptions(): Record<ID, Array<{ value: string | false; text: string; disabled?: boolean }>> {
		return mapValues(pickBy(this.customTypes, (customType, customTypeId) => this.activeFileResultsByType[customTypeId as any].length > 0), (customType, customTypeId) => {
			const options: Array<{ value: string | false; text: string; disabled?: boolean }> = [];

			for (const type of Object.values(this.client.types)) {
				if (type.name == customType.name && type.type == customType.type)
					options.push({ value: `e${type.id}`, text: `Existing type “${type.name}”` });
			}

			if (this.client.writable == 2)
				options.push({ value: `i${customTypeId}`, text: `Import type “${customType.name}”` });

			options.push({ value: false, text: "Do not import" });
			options.push({ value: false, text: "──────────", disabled: true });

			for (const type of Object.values(this.client.types)) {
				if (type.name != customType.name && type.type == customType.type)
					options.push({ value: `e${type.id}`, text: `Existing type “${type.name}”` });
			}

			for (const customTypeId2 of Object.keys(this.customTypes)) {
				const customType2 = this.customTypes[customTypeId2 as any];
				if (this.client.writable == 2 && customType2.type == customType.type && customTypeId2 != customTypeId)
					options.push({ value: `i${customTypeId2}`, text: `Import type “${customType2.name}”` });
			}

			return options;
		});
	}

	get untypedMarkerMappingOptions(): Array<{ value: string | false; text: string }> {
		const options: Array<{ value: string | false; text: string }> = [];
		options.push({ value: false, text: "Do not import" });

		for (const customTypeId of Object.keys(this.customTypes)) {
			const customType = this.customTypes[customTypeId as any];
			if (this.client.writable && customType.type == "marker")
				options.push({ value: `i${customTypeId}`, text: `Import type “${customType.name}”` });
		}

		for (const type of Object.values(this.client.types)) {
			if (type.type == "marker")
				options.push({ value: `e${type.id}`, text: `Existing type “${type.name}”` });
		}

		return options;
	}

	get untypedLineMappingOptions(): Array<{ value: string | false; text: string }> {
		const options: Array<{ value: string | false; text: string }> = [];
		options.push({ value: false, text: "Do not import" });

		for (const customTypeId of Object.keys(this.customTypes)) {
			const customType = this.customTypes[customTypeId as any];
			if (this.client.writable && customType.type == "line")
				options.push({ value: `i${customTypeId}`, text: `Import type “${customType.name}”` });
		}

		for (const type of Object.values(this.client.types)) {
			if (type.type == "line")
				options.push({ value: `e${type.id}`, text: `Existing type “${type.name}”` });
		}

		return options;
	}

	initializeCustomImport(): void {
		this.customMapping = mapValues(this.customMappingOptions, (options) => options[0].value);
		this.untypedMarkerMapping = false;
		this.untypedLineMapping = false;
	}

	async customImport(): Promise<void> {
		this.$bvToast.hide("fm-search-result-info-add-error");
		this.isCustomImportSaving = true;

		try {
			const resolvedMapping: Record<string, Type> = {};
			for (const id of uniq([...Object.values(this.customMapping), this.untypedMarkerMapping, this.untypedLineMapping])) {
				if (id !== false) {
					const m = id.match(/^([ei])(.*)$/);
					if (m && m[1] == "e")
						resolvedMapping[id] = this.client.types[m[2] as any];
					else if (m && m[1] == "i")
						resolvedMapping[id] = await this.client.addType(this.customTypes[m[2] as any]);
				}
			}

			const add = this.activeFileResults.flatMap((result) => {
				const id = (result.fmTypeId && this.customMapping[result.fmTypeId]) ? this.customMapping[result.fmTypeId] : isMarkerResult(result) ? this.untypedMarkerMapping : this.untypedLineMapping;
				return id !== false && resolvedMapping[id] ? [{ result, type: resolvedMapping[id] }] : [];
			});
			
			if (await this._addToMap(add))
				this.$bvModal.hide("fm-search-results-custom-import");
		} catch(err) {
			showErrorToast(this, "fm-search-result-info-add-error", "Error importing to map", err);
		} finally {
			this.isCustomImportSaving = false;
		}
	}

}