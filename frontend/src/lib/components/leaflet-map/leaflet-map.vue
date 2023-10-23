<script lang="ts">
	import { DeepReadonly, inject, InjectionKey, Ref, computed, onMounted, ref, defineComponent, provide } from "vue";
	import L, { LatLng, LatLngBounds, Map } from "leaflet";
	import "leaflet/dist/leaflet.css";
	import { BboxHandler, HashHandler, LinesLayer, MarkersLayer, SearchResultsLayer, OverpassLayer, VisibleLayers, HashQuery, OverpassPreset } from "facilmap-leaflet";
	import "leaflet.locatecontrol";
	import "leaflet.locatecontrol/dist/L.Control.Locate.css";
	import "leaflet-graphicscale";
	import "leaflet-graphicscale/src/Leaflet.GraphicScale.scss";
	import "leaflet-mouse-position";
	import "leaflet-mouse-position/src/L.Control.MousePosition.css";
	import SelectionHandler, { SelectedItem } from "../../utils/selection";
	import { injectClientRequired } from "../client-context.vue";
	import { injectContextRequired } from "../../utils/context";
	import { FindOnMapResult, Point, SearchResult } from "facilmap-types";
	import { FilterFunc } from "facilmap-utils";
	import { Emitter } from "mitt";
	import { createMapContext } from "./components";

	export type MapContextEvents = {
		"import-file": void;
		"open-selection": { selection: SelectedItem[] };
		"search-box-show-tab": { id: string; expand?: boolean };
		"search-set-query": { query: string; zoom?: boolean; smooth?: boolean };
		"route-set-query": { query: string; zoom?: boolean; smooth?: boolean };
		"route-set-from": { query: string; searchSuggestions?: SearchResult[]; mapSuggestions?: FindOnMapResult[]; selectedSuggestion?: SearchResult | FindOnMapResult };
		"route-add-via": { query: string; searchSuggestions?: SearchResult[]; mapSuggestions?: FindOnMapResult[]; selectedSuggestion?: SearchResult | FindOnMapResult };
		"route-set-to": { query: string; searchSuggestions?: SearchResult[]; mapSuggestions?: FindOnMapResult[]; selectedSuggestion?: SearchResult | FindOnMapResult };
		"map-long-click": { point: Point };
	};

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

	export type MapContextData = {
		center: LatLng;
		zoom: number;
		bounds: LatLngBounds;
		layers: VisibleLayers;
		filter: string | undefined;
		filterFunc: FilterFunc;
		hash: string;
		showToolbox: boolean;
		selection: SelectedItem[];
		activeQuery: HashQuery | undefined;
		fallbackQuery: HashQuery | undefined;
		setFallbackQuery: (query: HashQuery | undefined) => void;
		interaction: boolean;
		loading: number;
		overpassIsCustom: boolean;
		overpassPresets: OverpassPreset[];
		overpassCustom: string;
		overpassMessage: string | undefined;
		components: MapComponents;
	};

	export type WritableMapContext = MapContextData & Emitter<MapContextEvents>;

	export type MapContext = DeepReadonly<Omit<WritableMapContext, "components">> & {
		readonly components: Readonly<WritableMapContext["components"]>;
	};

	const mapContextInject = Symbol("mapContextInject") as InjectionKey<MapContext>;

	export function injectMapContextOptional(): MapContext | undefined {
		return inject(mapContextInject);
	}

	export function injectMapContextRequired(): MapContext {
		const mapContext = injectMapContextOptional();
		if (!mapContext) {
			throw new Error("No map context injected.");
		}
		return mapContext;
	}
</script>

<script setup lang="ts">
	const client = injectClientRequired();
	const context = injectContextRequired();

	const innerContainerRef = ref<HTMLElement>();
	const mapRef = ref<HTMLElement>();

	const loaded = ref(false);

	const selfUrl = computed(() => {
		return `${location.origin}${location.pathname}${mapContext.value?.hash ? `#${mapContext.value.hash}` : ''}`;
	});

	const mapContext = ref<MapContext>();

	onMounted(async () => {
		mapContext.value = await createMapContext(client, context, mapRef as Ref<HTMLElement>, innerContainerRef as Ref<HTMLElement>);
	});

	const MapContextProvider = defineComponent({
		setup(props, { slots }) {
			provide(mapContextInject, mapContext.value!);
			return slots.default;
		}
	});
</script>

<template>
	<div class="fm-leaflet-map-container" :class="{ isNarrow: context.isNarrow }">
		<MapContextProvider v-if="mapContext">
			<slot name="before"></slot>
		</MapContextProvider>

		<div class="fm-leaflet-map-wrapper">
			<div class="fm-leaflet-map-inner-container" ref="innerContainerRef">
				<div class="fm-leaflet-map" ref="mapRef"></div>

				<div v-if="mapContext && mapContext.overpassMessage" class="alert alert-warning fm-overpass-message">
					{{mapContext.overpassMessage}}
				</div>

				<a v-if="context.linkLogo" :href="selfUrl" target="_blank" class="fm-open-external" uib-tooltip="Open FacilMap in full size" tooltip-placement="right"></a>
				<div class="fm-logo">
					<img src="./logo.png"/>
				</div>

				<div class="spinner-border fm-leaflet-map-spinner" v-show="client.loading > 0 || (mapContext && mapContext.loading > 0)"></div>

				<MapContextProvider v-if="mapContext">
					<slot></slot>
				</MapContextProvider>
			</div>

			<MapContextProvider v-if="mapContext">
				<slot name="after"></slot>
			</MapContextProvider>
		</div>

		<div class="fm-leaflet-map-disabled-cover" v-show="client.padId && (client.disconnected || client.serverError || client.deleted)"></div>
		<div class="fm-leaflet-map-loading" v-show="!loaded && !client.serverError">
			Loading...
		</div>
	</div>
</template>

<style lang="scss">
	.fm-leaflet-map-container {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		position: relative;

		.fm-leaflet-map-wrapper {
			display: flex;
			flex-direction: column;
			flex-grow: 1;
			position: relative;
		}

		.fm-leaflet-map-inner-container {
			position: relative;
			flex-grow: 1;
		}

		.fm-leaflet-map {
			position: absolute;
			top: 0;
			right: 0;
			left: 0;
			bottom: 0;
			z-index: 0;
			user-select: none;
			-webkit-user-select: none;

			.fm-leaflet-center {
				left: 50%;
				transform: translateX(-50%);
				text-align: center;

				.leaflet-control {
					display: inline-block;
					float: none;
					clear: none;
				}
			}

			.leaflet-control.leaflet-control-mouseposition {
				float: left;
				pointer-events: none;
				padding-right: 0;

				&:after {
					content: " |";
				}

				& + * {
					clear: none;
				}
			}

			.leaflet-control.leaflet-control-graphicscale {
				margin-bottom: 0;
				pointer-events: none;

				.label {
					color: #000;
					text-shadow: 0 0 3px #fff, 0 0 5px #fff, 0 0 10px #fff;
				}
			}

			.leaflet-control-locate.leaflet-control-locate a {
				font-size: inherit;
				display: inline-flex;
				align-items: center;
				justify-content: center;
			}

		}

		&.isNarrow {
			.leaflet-control-graphicscale,.leaflet-control-mouseposition {
				display: none !important;
			}
		}

		.fm-leaflet-map-disabled-cover {
			background-color: #888;
			opacity: 0.7;
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			z-index: 10001;
		}

		.fm-leaflet-map-loading {
			position:absolute;
			top:0;
			left:0;
			right:0;
			bottom:0;
			padding:10px;
			background: #fff;
			z-index:100000;
			font-size:1.5em;
			font-weight:bold;
		}

		.fm-overpass-message {
			position: absolute;
			top: 10px;
			right: 50%;
			transform: translateX(50%);
			max-width: calc(100vw - 1050px);
		}

		&.isNarrow .fm-overpass-message {
			max-width: none;
		}

		@media(max-width: 1250px) {
			&:not(.isNarrow) .fm-overpass-message {
				top: 69px;
				right: 10px;
				transform: none;
				max-width: 400px;
			}
		}

		.fm-leaflet-map-spinner {
			position:absolute;
			bottom: 20px;
			left: 115px;
			color: #00272a;
		}

		.fm-logo {
			position: absolute;
			bottom: 0;
			left: -25px;
			pointer-events: none;
			overflow: hidden;
			user-select: none;
			-webkit-user-select: none;

			img {
				margin-bottom: -24px;
			}
		}

		.fm-open-external {
			position: absolute;
			bottom: 15px;
			left: 15px;
			width: 90px;
			height: 50px;
		}

	}
</style>