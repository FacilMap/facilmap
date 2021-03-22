import WithRender from "./click-marker.vue";
import Vue from "vue";
import { Component, Watch } from "vue-property-decorator";
import { InjectClient, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import { LineCreate, MarkerCreate, Point, SearchResult, Type } from "facilmap-types";
import Client from "facilmap-client";
import { round } from "facilmap-utils";
import { lineStringToTrackPoints, mapSearchResultToType } from "../search-results/utils";
import { showErrorToast } from "../../utils/toasts";
import { SearchResultsLayer } from "facilmap-leaflet";
import SearchResultInfo from "../search-result-info/search-result-info";
import Icon from "../ui/icon/icon";
import { Util } from "leaflet";

@WithRender
@Component({
	components: { Icon, SearchResultInfo }
})
export default class ClickMarker extends Vue {

	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;
	@InjectClient() client!: Client;

	lastClick = 0;

	results: SearchResult[] = [];
	layers!: SearchResultsLayer[]; // Don't make layer objects reactive

	mounted(): void {
		this.layers = [];
		this.mapContext.$on("fm-map-click", this.handleMapClick);
		this.mapContext.$on("fm-open-selection", this.handleOpenSelection);
	}

	beforeDestroy(): void {
		this.mapContext.$off("fm-map-click", this.handleMapClick);
		this.mapContext.$off("fm-open-selection", this.handleOpenSelection);
	}

	get layerIds(): number[] {
		return this.results.map((result, i) => { // Iterate files instead of layers because it is reactive
			return Util.stamp(this.layers[i]);
		});
	}

	@Watch("mapContext.selection")
	handleSelectionChange(): void {
		for (let i = this.results.length - 1; i >= 0; i--) {
			if (!this.mapContext.selection.some((item) => item.type == "searchResult" && item.layerId == this.layerIds[i]))
				this.close(this.results[i]);
		}
	}

	handleOpenSelection(): void {
		for (let i = 0; i < this.layerIds.length; i++) {
			if (this.mapContext.selection.some((item) => item.type == "searchResult" && item.layerId == this.layerIds[i])) {
				this.mapContext.$emit("fm-search-box-show-tab", `fm-click-marker-tab-${i}`);
				break;
			}
		}
	}

	async handleMapClick(pos: Point): Promise<void> {
		const now = Date.now();
		if (now - this.lastClick < 500) {
			// Hacky solution to avoid markers being created when the user double-clicks the map. If multiple clicks happen less than 500 ms from each
			// other, all those clicks are ignored.
			this.lastClick = now;
			return;
		}
		
		this.lastClick = now;

		const [results] = await Promise.all([
			this.client.find({
				query: `geo:${round(pos.lat, 5)},${round(pos.lon, 5)}?z=${this.mapContext.zoom}`,
				loadUrls: false,
				elevation: true
			}),
			new Promise((resolve) => {
				// Specify the minimum time the search will take to allow for some time for the double-click detection
				setTimeout(resolve, 500);
			})
		]);

		if (now !== this.lastClick) {
			// There has been another click since the one we are reacting to.
			return;
		}

		if (results.length > 0) {
			const layer = new SearchResultsLayer([results[0]]).addTo(this.mapComponents.map);
			this.mapComponents.selectionHandler.addSearchResultLayer(layer);

			this.results.push(results[0]);
			this.layers.push(layer);

			this.mapComponents.selectionHandler.setSelectedItems([{ type: "searchResult", result: results[0], layerId: Util.stamp(layer) }]);

			setTimeout(() => {
				this.mapContext.$emit("fm-search-box-show-tab", `fm-click-marker-tab-${this.results.length - 1}`);
			}, 0);
		}
	}

	close(result: SearchResult): void {
		const idx = this.results.indexOf(result);
		if (idx == -1)
			return;

		this.mapComponents.selectionHandler.removeSearchResultLayer(this.layers[idx]);
		this.layers[idx].remove();
		this.results.splice(idx, 1);
		this.layers.splice(idx, 1);
	}

	clear(): void {
		for (let i = this.results.length - 1; i >= 0; i--)
			this.close(this.results[i]);
	}

	async addToMap(result: SearchResult, type: Type): Promise<void> {
		this.$bvToast.hide("fm-click-marker-add-error");

		try {
			const obj: Partial<MarkerCreate & LineCreate> = {
				name: result.short_name,
				data: mapSearchResultToType(result, type)
			};

			if(type.type == "marker") {
				const marker = await this.client.addMarker({
					...obj,
					lat: result.lat!,
					lon: result.lon!,
					typeId: type.id
				});

				this.mapComponents.selectionHandler.setSelectedItems([{ type: "marker", id: marker.id }], true);
			} else if(type.type == "line") {
				const trackPoints = lineStringToTrackPoints(result.geojson as any);
				const line = await this.client.addLine({
					...obj,
					typeId: type.id,
					routePoints: [trackPoints[0], trackPoints[trackPoints.length-1]],
					trackPoints: trackPoints,
					mode: "track"
				});

				this.mapComponents.selectionHandler.setSelectedItems([{ type: "line", id: line.id }], true);
			}

			this.close(result);
		} catch (err) {
			showErrorToast(this, "fm-click-marker-add-error", "Error adding to map", err);
		}
	}

	useAs(result: SearchResult, event: "fm-route-set-from" | "fm-route-add-via" | "fm-route-set-to"): void {
		this.mapContext.$emit(event, result.short_name, [result], [], result);
		this.mapContext.$emit("fm-search-box-show-tab", "fm-route-form-tab");
	}

	useAsFrom(result: SearchResult): void {
		this.useAs(result, "fm-route-set-from");
	}

	useAsVia(result: SearchResult): void {
		this.useAs(result, "fm-route-add-via");
	}

	useAsTo(result: SearchResult): void {
		this.useAs(result, "fm-route-set-to");
	}

}

/*
// TODO
var clickMarker = L.featureGroup([]).addTo(map.map);

map.mapEvents.$on("longmousedown", function(e, latlng) {
	clickMarker.clearLayers();

	map.client.find({ query: "geo:" + fmUtils.round(latlng.lat, 5) + "," + fmUtils.round(latlng.lng, 5) + "?z=" + map.map.getZoom(), loadUrls: false, elevation: true }).then(function(results) {
		clickMarker.clearLayers();

		if(results.length > 0) {
			prepareResults(results);

			renderResult(fmUtils.round(latlng.lat, 5) + "," + fmUtils.round(latlng.lng, 5), results, results[0], true, clickMarker, () => {
				clickMarker.clearLayers();
			}, true);
			currentInfoBox = null; // We don't want it to be cleared when we switch to the routing form for example
		}
	}).catch(function(err) {
		map.messages.showMessage("danger", err);
	});
});
*/