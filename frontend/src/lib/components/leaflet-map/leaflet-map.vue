<script setup lang="ts">
	import { computed, markRaw, onBeforeUnmount, onMounted, ref, watch } from "vue";
	import L from "leaflet";
	import "leaflet/dist/leaflet.css";
	import { BboxHandler, getSymbolHtml, displayView, getInitialView, getVisibleLayers, HashHandler, LinesLayer, MarkersLayer, SearchResultsLayer, OverpassLayer, OverpassLoadStatus } from "facilmap-leaflet";
	import "leaflet.locatecontrol";
	import "leaflet.locatecontrol/dist/L.Control.Locate.css";
	import "leaflet-graphicscale";
	import "leaflet-graphicscale/src/Leaflet.GraphicScale.scss";
	import "leaflet-mouse-position";
	import "leaflet-mouse-position/src/L.Control.MousePosition.css";
	import SelectionHandler from "../../utils/selection";
	import { getHashQuery, openSpecialQuery } from "../../utils/zoom";
	import { injectClientRequired } from "../../utils/client";
	import { injectContextRequired } from "../../utils/context";
	import { MapComponents, provideMapComponents } from "../../utils/map-components";
	import { MapContext, MapContextData, createMapContext, provideMapContext } from "../../utils/map-context";

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

	const client = injectClientRequired();
	const context = injectContextRequired();

	const mapComponents = ref<MapComponents>();
	provideMapComponents(mapComponents);

	const mapContext = ref<MapContext>();
	provideMapContext(mapContext);

	const innerContainerRef = ref<HTMLElement>();
	const mapRef = ref<HTMLElement>();

	const loaded = ref(false);
	const interaction = ref(0);

	const selfUrl = computed(() => {
		return `${location.origin}${location.pathname}${mapContext.value?.hash ? `#${mapContext.value.hash}` : ''}`;
	});

	onMounted(() => {
		const map = L.map(mapRef.value!, { boxZoom: false });

		map._controlCorners.bottomcenter = L.DomUtil.create("div", "leaflet-bottom fm-leaflet-center", map._controlContainer);

		const bboxHandler = new BboxHandler(map, client.value).enable();
		const graphicScale = L.control.graphicScale({ fill: "hollow", position: "bottomcenter" }).addTo(map);
		const linesLayer = new LinesLayer(client.value).addTo(map);
		const locateControl = L.control.locate({ flyTo: true, icon: "a", iconLoading: "a", markerStyle: { pane: "fm-raised-marker", zIndexOffset: 10000 } }).addTo(map);
		const markersLayer = new MarkersLayer(client.value).addTo(map);
		const mousePosition = L.control.mousePosition({ emptyString: "0, 0", separator: ", ", position: "bottomright" }).addTo(map);
		const overpassLayer = new OverpassLayer([], { markerShape: "rectangle-marker" }).addTo(map);
		const searchResultsLayer = new SearchResultsLayer(undefined, { pathOptions: { weight: 7 } }).addTo(map);
		const selectionHandler = new SelectionHandler(map, markersLayer, linesLayer, searchResultsLayer, overpassLayer).enable();

		// Bind these handlers before hashHandler may change the value
		mapContext.value = createMapContext({
			overpassIsCustom: false,
			overpassPresets: [],
			overpassCustom: "",
			loading: 0
		} satisfies Partial<MapContextData> as any);

		overpassLayer.on("setQuery", ({ query }: any) => {
			mapContext.value!.overpassIsCustom = typeof query == "string";
			if (mapContext.value!.overpassIsCustom)
				mapContext.value!.overpassCustom = query && typeof query == "string" ? query : "";
			else
				mapContext.value!.overpassPresets = Array.isArray(query) ? query : [];
		});

		overpassLayer.on("loadstart", () => {
			mapContext.value!.loading++;
		});

		overpassLayer.on("loadend", ({ status, error }: any) => {
			mapContext.value!.loading--;

			if (status == OverpassLoadStatus.COMPLETE)
				mapContext.value!.overpassMessage = undefined;
			else if (status == OverpassLoadStatus.INCOMPLETE)
				mapContext.value!.overpassMessage = "Not all POIs are shown because there are too many results. Zoom in to show all results.";
			else if (status == OverpassLoadStatus.TIMEOUT)
				mapContext.value!.overpassMessage = "Zoom in to show POIs.";
			else if (status == OverpassLoadStatus.ERROR)
				mapContext.value!.overpassMessage = "Error loading POIs: " + error.message;
		});

		overpassLayer.on("clear", () => {
			mapContext.value!.overpassMessage = undefined;
		});

		const hashHandler = new HashHandler(map, client.value, { overpassLayer, simulate: !context.updateHash })
			.on("fmQueryChange", handleNewHashQuery)
			.enable();

		mapComponents.value = {
			bboxHandler: markRaw(bboxHandler),
			container: innerContainerRef.value!,
			graphicScale: markRaw(graphicScale),
			hashHandler: markRaw(hashHandler),
			linesLayer: markRaw(linesLayer),
			locateControl: markRaw(locateControl),
			map: markRaw(map),
			markersLayer: markRaw(markersLayer),
			mousePosition: markRaw(mousePosition),
			overpassLayer: markRaw(overpassLayer),
			searchResultsLayer: markRaw(searchResultsLayer),
			selectionHandler: markRaw(selectionHandler)
		};

		watch(() => innerContainerRef.value, () => {
			if (innerContainerRef.value) {
				mapComponents.value!.container = innerContainerRef.value;
			}
		});

		mapComponents.value.locateControl._container.querySelector("a")!.insertAdjacentHTML("beforeend", getSymbolHtml("currentColor", "1.5em", "screenshot"));

		(async () => {
			if (!map._loaded) {
				try {
					// Initial view was not set by hash handler
					displayView(map, await getInitialView(client.value), { overpassLayer });
				} catch (error) {
					console.error(error);
					displayView(map, undefined, { overpassLayer });
				}
			}
			loaded.value = true;
		})();

		Object.assign(mapContext.value, {
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
			fallbackQuery: undefined
		});

		watch(() => interaction.value, () => {
			mapContext.value!.interaction = interaction.value > 0;
		}, { immediate: true });

		map.on("moveend", () => {
			mapContext.value!.center = map.getCenter();
			mapContext.value!.zoom = map.getZoom();
			mapContext.value!.bounds = map.getBounds();
		});

		map.on("fmFilter", () => {
			mapContext.value!.filter = map.fmFilter;
			mapContext.value!.filterFunc = map.fmFilterFunc;
		});

		map.on("layeradd layerremove", () => {
			mapContext.value!.layers = getVisibleLayers(map);
		});

		map.on("fmInteractionStart", () => {
			interaction.value++;
		});

		map.on("fmInteractionEnd", () => {
			interaction.value--;
		});

		hashHandler.on("fmHash", (e: any) => {
			mapContext.value!.hash = e.hash;
		});

		selectionHandler.on("fmChangeSelection", (event: any) => {
			const selection = selectionHandler.getSelection();
			mapContext.value!.selection = selection;

			if (event.open) {
				setTimeout(() => {
					mapContext.value!.emit("open-selection", { selection });
				}, 0);
			}
		});

		selectionHandler.on("fmLongClick", (event: any) => {
			mapContext.value!.emit("map-long-click", { point: { lat: event.latlng.lat, lon: event.latlng.lng } });
		});
	});

	onBeforeUnmount(() => {
		mapComponents.value!.bboxHandler.disable();
		mapComponents.value!.hashHandler.disable();
		mapComponents.value!.selectionHandler.disable();
		mapComponents.value!.map.remove();
	});

	watch([
		() => mapContext.value?.selection,
		() => mapContext.value?.fallbackQuery
	], () => {
		mapContext.value!.activeQuery = getHashQuery(mapComponents.value!.map, client.value, mapContext.value!.selection) || mapContext.value!.fallbackQuery;
		mapComponents.value!.hashHandler.setQuery(mapContext.value!.activeQuery);
	});

	async function handleNewHashQuery(e: any): Promise<void> {
		let smooth = true;
		if (!mapComponents.value) {
			// This is called while the hash handler is being enabled, so it is the initial view
			smooth = false;
			await new Promise((resolve) => { setTimeout(resolve); });
		}

		if (!e.query)
			mapContext.value!.emit("search-set-query", { query: "", zoom: false, smooth: false });
		else if (!await openSpecialQuery(e.query, context, client.value, mapComponents.value!, mapContext.value!, e.zoom, smooth))
			mapContext.value!.emit("search-set-query", { query: e.query, zoom: e.zoom, smooth });
	}
</script>

<template>
	<div class="fm-leaflet-map-container" :class="{ isNarrow: context.isNarrow }">
		<slot name="before" v-if="mapContext"></slot>

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