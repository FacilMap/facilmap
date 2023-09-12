<script setup lang="ts">
	import WithRender from "./click-marker.vue";
	import Vue from "vue";
	import { Component, Watch } from "vue-property-decorator";
	import { InjectClient, Client, InjectMapComponents, InjectMapContext, InjectContext } from "../../utils/decorators";
	import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
	import { LineCreate, MarkerCreate, Point, SearchResult, Type } from "facilmap-types";
	import { round } from "facilmap-utils";
	import { lineStringToTrackPoints, mapSearchResultToType } from "../search-results/utils";
	import { showErrorToast } from "../../utils/toasts";
	import { SearchResultsLayer } from "facilmap-leaflet";
	import SearchResultInfo from "../search-result-info/search-result-info";
	import Icon from "../ui/icon/icon";
	import { Util } from "leaflet";
	import StringMap from "../../utils/string-map";
	import { Portal } from "portal-vue";
	import { Context } from "../facilmap/facilmap";

	@WithRender
	@Component({
		components: { Icon, Portal, SearchResultInfo }
	})
	export default class ClickMarker extends Vue {

		@InjectContext() context!: Context;
		@InjectMapContext() mapContext!: MapContext;
		@InjectMapComponents() mapComponents!: MapComponents;
		@InjectClient() client!: Client;

		lastClick = 0;

		results: SearchResult[] = [];
		layers!: SearchResultsLayer[]; // Don't make layer objects reactive
		isAdding = false;

		mounted(): void {
			this.layers = [];
			this.mapContext.$on("fm-map-long-click", this.handleMapLongClick);
			this.mapContext.$on("fm-open-selection", this.handleOpenSelection);
		}

		beforeDestroy(): void {
			this.mapContext.$off("fm-map-long-click", this.handleMapLongClick);
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
					this.mapContext.$emit("fm-search-box-show-tab", `fm${this.context.id}-click-marker-tab-${i}`);
					break;
				}
			}
		}

		async handleMapLongClick(pos: Point): Promise<void> {
			const now = Date.now();
			this.lastClick = now;

			const results = await this.client.find({
				query: `geo:${round(pos.lat, 5)},${round(pos.lon, 5)}?z=${this.mapContext.zoom}`,
				loadUrls: false,
				elevation: true
			});

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
					this.mapContext.$emit("fm-search-box-show-tab", `fm${this.context.id}-click-marker-tab-${this.results.length - 1}`);
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
			this.$bvToast.hide(`fm${this.context.id}-click-marker-add-error`);
			this.isAdding = true;

			try {
				const obj: Partial<MarkerCreate<StringMap> & LineCreate<StringMap>> = {
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
				showErrorToast(this, `fm${this.context.id}-click-marker-add-error`, "Error adding to map", err);
			} finally {
				this.isAdding = false;
			}
		}

		useAs(result: SearchResult, event: "fm-route-set-from" | "fm-route-add-via" | "fm-route-set-to"): void {
			this.mapContext.$emit(event, result.short_name, [result], [], result);
			this.mapContext.$emit("fm-search-box-show-tab", `fm${this.context.id}-route-form-tab`);
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
</script>

<template>
	<portal to="fm-search-box">
		<b-tab v-for="(result, idx) in results" :id="`fm${context.id}-click-marker-tab-${idx}`">
			<template #title>
				<span class="closeable-tab-title">
					<span>{{result.short_name}}</span>
					<object><a href="javascript:" @click="close(result)"><Icon icon="remove" alt="Close"></Icon></a></object>
				</span>
			</template>
			<SearchResultInfo
				:result="result"
				:is-adding="isAdding"
				@add-to-map="addToMap(result, $event)"
				@use-as-from="useAsFrom(result)"
				@use-as-via="useAsVia(result)"
				@use-as-to="useAsTo(result)"
			></SearchResultInfo>
		</b-tab>
	</portal>
</template>