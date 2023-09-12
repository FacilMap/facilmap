<script lang="ts">
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

	export interface MapContext extends EventBus {
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
		fallbackQuery: HashQuery | undefined; // Updated by search-box
		interaction: boolean;
		loading: number;
		overpassIsCustom: boolean;
		overpassPresets: OverpassPreset[];
		overpassCustom: string;
		overpassMessage: string | undefined;
	}

	const mapContextInject = Symbol("mapContextInject") as InjectionKey<MapContext>;

	function provideMapContext(mapContext: MapContext): void {
		provide(mapContextInject, mapContext);
	}

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
	import WithRender from "./leaflet-map.vue";
	import Vue, { InjectionKey, Ref, inject, provide } from "vue";
	import { Component, ProvideReactive, Ref, Watch } from "vue-property-decorator";
	import "./leaflet-map.scss";
	import { Client, InjectClient, InjectContext, MAP_COMPONENTS_INJECT_KEY, MAP_CONTEXT_INJECT_KEY } from "../../utils/decorators";
	import L, { LatLng, LatLngBounds, Map } from "leaflet";
	import "leaflet/dist/leaflet.css";
	import { BboxHandler, getSymbolHtml, displayView, getInitialView, getVisibleLayers, HashHandler, LinesLayer, MarkersLayer, SearchResultsLayer, VisibleLayers, HashQuery, OverpassLayer, OverpassPreset, OverpassLoadStatus } from "facilmap-leaflet";
	import "leaflet.locatecontrol";
	import "leaflet.locatecontrol/dist/L.Control.Locate.css";
	import "leaflet-graphicscale";
	import "leaflet-graphicscale/src/Leaflet.GraphicScale.scss";
	import "leaflet-mouse-position";
	import "leaflet-mouse-position/src/L.Control.MousePosition.css";
	import $ from "jquery";
	import SelectionHandler, { SelectedItem } from "../../utils/selection";
	import { FilterFunc } from "facilmap-utils";
	import { getHashQuery, openSpecialQuery } from "../../utils/zoom";
	import { createEventBus, EventBus } from "./events";
	import { Context } from "../facilmap/facilmap";

	/* function createButton(symbol: string, onClick: () => void): Control {
		return Object.assign(new Control(), {
			onAdd() {
				const div = document.createElement('div');
				div.className = "leaflet-bar";
				const a = document.createElement('a');
				a.href = "javascript:";
				a.innerHTML = createSymbolHtml("currentColor", "1.5em", symbol);
				a.addEventListener("click", (e) => {
					e.preventDefault();
					onClick();
				});
				div.appendChild(a);
				return div;
			}
		});
	} */

	@WithRender
	@Component({
		components: { }
	})
	export default class LeafletMap extends Vue {

		@InjectClient() client!: Client;
		@InjectContext() context!: Context;

		@ProvideReactive(MAP_COMPONENTS_INJECT_KEY) mapComponents: MapComponents = null as any;
		@ProvideReactive(MAP_CONTEXT_INJECT_KEY) mapContext: MapContext = null as any;

		@Ref() innerContainer!: HTMLElement;

		loaded = false;
		interaction = 0;

		get selfUrl(): string {
			return `${location.origin}${location.pathname}${this.mapContext?.hash ? `#${this.mapContext.hash}` : ''}`;
		}

		mounted(): void {
			const el = this.$el.querySelector(".fm-leaflet-map") as HTMLElement;
			const map = L.map(el, { boxZoom: false });

			map._controlCorners.bottomcenter = L.DomUtil.create("div", "leaflet-bottom fm-leaflet-center", map._controlContainer);

			const bboxHandler = new BboxHandler(map, this.client).enable();
			const container = this.innerContainer;
			const graphicScale = L.control.graphicScale({ fill: "hollow", position: "bottomcenter" }).addTo(map);
			const linesLayer = new LinesLayer(this.client).addTo(map);
			const locateControl = L.control.locate({ flyTo: true, icon: "a", iconLoading: "a", markerStyle: { pane: "fm-raised-marker", zIndexOffset: 10000 } }).addTo(map);
			const markersLayer = new MarkersLayer(this.client).addTo(map);
			const mousePosition = L.control.mousePosition({ emptyString: "0, 0", separator: ", ", position: "bottomright" }).addTo(map);
			const overpassLayer = new OverpassLayer([], { markerShape: "rectangle-marker" }).addTo(map);
			const searchResultsLayer = new SearchResultsLayer(undefined, { pathOptions: { weight: 7 } }).addTo(map);
			const selectionHandler = new SelectionHandler(map, markersLayer, linesLayer, searchResultsLayer, overpassLayer).enable();

			// Bind these handlers before hashHandler may change the value
			this.mapContext = {
				overpassIsCustom: false,
				overpassPresets: [],
				overpassCustom: "",
				loading: 0
			} as any;
			overpassLayer.on("setQuery", ({ query }: any) => {
				this.mapContext.overpassIsCustom = typeof query == "string";
				if (this.mapContext.overpassIsCustom)
					this.mapContext.overpassCustom = query && typeof query == "string" ? query : "";
				else
					this.mapContext.overpassPresets = Array.isArray(query) ? query : [];
			});
			overpassLayer.on("loadstart", () => {
				this.mapContext.loading++;
			});
			overpassLayer.on("loadend", ({ status, error }: any) => {
				this.mapContext.loading--;

				if (status == OverpassLoadStatus.COMPLETE)
					this.mapContext.overpassMessage = undefined;
				else if (status == OverpassLoadStatus.INCOMPLETE)
					this.mapContext.overpassMessage = "Not all POIs are shown because there are too many results. Zoom in to show all results.";
				else if (status == OverpassLoadStatus.TIMEOUT)
					this.mapContext.overpassMessage = "Zoom in to show POIs.";
				else if (status == OverpassLoadStatus.ERROR)
					this.mapContext.overpassMessage = "Error loading POIs: " + error.message;
			});
			overpassLayer.on("clear", () => {
				this.mapContext.overpassMessage = undefined;
			});

			const hashHandler = new HashHandler(map, this.client, { overpassLayer, simulate: !this.context.updateHash }).on("fmQueryChange", this.handleNewHashQuery).enable();

			this.mapComponents = Vue.nonreactive({ bboxHandler, container, graphicScale, hashHandler, linesLayer, locateControl, map,markersLayer, mousePosition, overpassLayer, searchResultsLayer, selectionHandler });
			for (const i of Object.keys(this.mapComponents) as Array<keyof MapComponents>)
				Vue.nonreactive(this.mapComponents[i]);

			$(this.mapComponents.locateControl._container).find("a").append(getSymbolHtml("currentColor", "1.5em", "screenshot"));

			(async () => {
				if (!map._loaded) {
					try {
						// Initial view was not set by hash handler
						displayView(map, await getInitialView(this.client), { overpassLayer });
					} catch (error) {
						console.error(error);
						displayView(map, undefined, { overpassLayer });
					}
				}
				this.loaded = true;
			})();

			this.mapContext = {
				center: map._loaded ? map.getCenter() : L.latLng(0, 0),
				zoom: map._loaded ? map.getZoom() : 1,
				bounds: map._loaded ? map.getBounds() : L.latLngBounds([0, 0], [0, 0]),
				layers: getVisibleLayers(map),
				filter: map.fmFilter,
				filterFunc: map.fmFilterFunc,
				hash: location.hash.replace(/^#/, ""),
				showToolbox: false,
				selection: [],
				activeQuery: undefined,
				fallbackQuery: undefined,
				interaction: false,
				loading: this.mapContext.loading,
				overpassIsCustom: this.mapContext.overpassIsCustom,
				overpassPresets: this.mapContext.overpassPresets,
				overpassCustom: this.mapContext.overpassCustom,
				overpassMessage: this.mapContext.overpassMessage,
				...createEventBus()
			};

			map.on("moveend", () => {
				this.mapContext.center = map.getCenter();
				this.mapContext.zoom = map.getZoom();
				this.mapContext.bounds = map.getBounds();
			});

			map.on("fmFilter", () => {
				this.mapContext.filter = map.fmFilter;
				this.mapContext.filterFunc = map.fmFilterFunc;
			});

			map.on("layeradd layerremove", () => {
				this.mapContext.layers = getVisibleLayers(map);
			});

			map.on("fmInteractionStart", () => {
				this.interaction++;
				this.mapContext.interaction = true;
			});

			map.on("fmInteractionEnd", () => {
				this.interaction--;
				this.mapContext.interaction = this.interaction > 0;
			});

			hashHandler.on("fmHash", (e: any) => {
				this.mapContext.hash = e.hash;
			});

			selectionHandler.on("fmChangeSelection", (event: any) => {
				const selection = selectionHandler.getSelection();
				Vue.set(this.mapContext, "selection", selection);

				if (event.open) {
					setTimeout(() => {
						this.mapContext.$emit("fm-open-selection", selection);
					}, 0);
				}
			});

			selectionHandler.on("fmLongClick", (event: any) => {
				this.mapContext.$emit("fm-map-long-click", { lat: event.latlng.lat, lon: event.latlng.lng });
			});
		}

		beforeDestroy(): void {
			this.mapComponents.bboxHandler.disable();
			this.mapComponents.hashHandler.disable();
			this.mapComponents.selectionHandler.disable();
			this.mapComponents.map.remove();
		}

		@Watch("mapContext.selection")
		@Watch("mapContext.fallbackQuery")
		handleActiveQueryChange(): void {
			if (!this.mapContext) // Not mounted yet
				return;

			this.mapContext.activeQuery = getHashQuery(this.mapComponents.map, this.client, this.mapContext.selection) || this.mapContext.fallbackQuery;
			this.mapComponents.hashHandler.setQuery(this.mapContext.activeQuery);
		}

		async handleNewHashQuery(e: any): Promise<void> {
			let smooth = true;
			if (!this.mapComponents) {
				// This is called while the hash handler is being enabled, so it is the initial view
				smooth = false;
				await new Promise((resolve) => { setTimeout(resolve); });
			}

			if (!e.query)
				this.mapContext.$emit("fm-search-set-query", "", false, false);
			else if (!await openSpecialQuery(e.query, this.context, this.client, this.mapComponents, this.mapContext, e.zoom, smooth))
				this.mapContext.$emit("fm-search-set-query", e.query, e.zoom, smooth);
		}

	}
</script>

<template>
	<div class="fm-leaflet-map-container" :class="{ isNarrow: context.isNarrow }">
		<slot name="before" v-if="mapContext"></slot>

		<div class="fm-leaflet-map-wrapper">
			<div class="fm-leaflet-map-inner-container" ref="innerContainer">
				<div class="fm-leaflet-map"></div>

				<b-alert v-if="mapContext" :show="!!mapContext.overpassMessage" class="fm-overpass-message" variant="warning">{{mapContext.overpassMessage}}</b-alert>

				<a v-if="context.linkLogo" :href="selfUrl" target="_blank" class="fm-open-external" uib-tooltip="Open FacilMap in full size" tooltip-placement="right"></a>
				<div class="fm-logo">
					<img src="./logo.png"/>
				</div>
				<b-spinner class="fm-leaflet-map-spinner" v-show="client.loading > 0 || (mapContext && mapContext.loading > 0)"></b-spinner>

				<slot v-if="mapContext"></slot>
			</div>

			<slot name="after" v-if="mapContext"></slot>
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