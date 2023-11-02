import { Ref, ref, watch, onScopeDispose, markRaw, reactive } from "vue";
import L, { latLng, latLngBounds, Map, map as leafletMap, DomUtil, control } from "leaflet";
import "leaflet/dist/leaflet.css";
import { BboxHandler, getSymbolHtml, getVisibleLayers, HashHandler, LinesLayer, MarkersLayer, SearchResultsLayer, OverpassLayer, OverpassLoadStatus, displayView, getInitialView } from "facilmap-leaflet";
import "leaflet.locatecontrol";
import "leaflet.locatecontrol/dist/L.Control.Locate.css";
import "leaflet-graphicscale";
import "leaflet-graphicscale/src/Leaflet.GraphicScale.scss";
import "leaflet-mouse-position";
import "leaflet-mouse-position/src/L.Control.MousePosition.css";
import SelectionHandler from "../../utils/selection";
import type { Client } from "../client-context.vue";
import type { MapComponents, MapContextData, MapContextEvents, WritableMapContext } from "./leaflet-map.vue";
import { getHashQuery, openSpecialQuery } from "../../utils/zoom";
import type { Context } from "../../utils/context";
import mitt from "mitt";
import type { Optional } from "../../utils/utils";

type MapContextWithoutComponents = Optional<WritableMapContext, 'components'>;

function createMap(element: HTMLElement, mapContext: MapContextWithoutComponents): Map {
	const interaction = ref(0);
	const map = leafletMap(element, { boxZoom: false });

	map._controlCorners.bottomcenter = DomUtil.create("div", "leaflet-bottom fm-leaflet-center", map._controlContainer);

	map.on("moveend", () => {
		mapContext.center = map.getCenter();
		mapContext.zoom = map.getZoom();
		mapContext.bounds = map.getBounds();
	});

	map.on("fmFilter", () => {
		mapContext.filter = map.fmFilter;
		mapContext.filterFunc = map.fmFilterFunc;
	});

	map.on("layeradd layerremove", () => {
		mapContext.layers = getVisibleLayers(map);
	});

	map.on("fmInteractionStart", () => {
		interaction.value++;
	});

	map.on("fmInteractionEnd", () => {
		interaction.value--;
	});

	watch(() => interaction.value, () => {
		mapContext.interaction = interaction.value > 0;
	}, { immediate: true });

	onScopeDispose(() => {
		map.remove();
	});

	return map;
}

function createBboxHandler(map: Map, client: Client): BboxHandler {
	const bboxHandler = new BboxHandler(map, client).enable();
	onScopeDispose(() => {
		bboxHandler.disable();
	});
	return bboxHandler;
}

function createGraphicScale(map: Map): any {
	return control.graphicScale({ fill: "hollow", position: "bottomcenter" }).addTo(map);
}

function createLinesLayer(map: Map, client: Client): LinesLayer {
	return new LinesLayer(client).addTo(map);
}

function createLocateControl(map: Map): L.Control.Locate {
	const locateControl = control.locate({ flyTo: true, icon: "a", iconLoading: "a", markerStyle: { pane: "fm-raised-marker", zIndexOffset: 10000 } }).addTo(map);
	locateControl._container.querySelector("a")!.insertAdjacentHTML("beforeend", getSymbolHtml("currentColor", "1.5em", "screenshot"));
	return locateControl;
}

function createMarkersLayer(map: Map, client: Client): MarkersLayer {
	return new MarkersLayer(client).addTo(map);
}

function createMousePosition(map: Map): L.Control.MousePosition {
	return control.mousePosition({ emptyString: "0, 0", separator: ", ", position: "bottomright" }).addTo(map);
}

function createOverpassLayer(map: Map, mapContext: MapContextWithoutComponents): OverpassLayer {
	const overpassLayer = new OverpassLayer([], { markerShape: "rectangle-marker" }).addTo(map);

	overpassLayer.on("setQuery", ({ query }: any) => {
		mapContext.overpassIsCustom = typeof query == "string";
		if (mapContext.overpassIsCustom)
			mapContext.overpassCustom = query && typeof query == "string" ? query : "";
		else
			mapContext.overpassPresets = Array.isArray(query) ? query : [];
	});

	overpassLayer.on("loadstart", () => {
		mapContext.loading++;
	});

	overpassLayer.on("loadend", ({ status, error }: any) => {
		mapContext.loading--;

		if (status == OverpassLoadStatus.COMPLETE)
			mapContext.overpassMessage = undefined;
		else if (status == OverpassLoadStatus.INCOMPLETE)
			mapContext.overpassMessage = "Not all POIs are shown because there are too many results. Zoom in to show all results.";
		else if (status == OverpassLoadStatus.TIMEOUT)
			mapContext.overpassMessage = "Zoom in to show POIs.";
		else if (status == OverpassLoadStatus.ERROR)
			mapContext.overpassMessage = "Error loading POIs: " + error.message;
	});

	overpassLayer.on("clear", () => {
		mapContext.overpassMessage = undefined;
	});

	return overpassLayer;
}

function createSearchResultsLayer(map: Map): SearchResultsLayer {
	return new SearchResultsLayer(undefined, { pathOptions: { weight: 7 } }).addTo(map);
}

function createSelectionHandler(map: Map, mapContext: MapContextWithoutComponents, markersLayer: MarkersLayer, linesLayer: LinesLayer, searchResultsLayer: SearchResultsLayer, overpassLayer: OverpassLayer): SelectionHandler {
	const selectionHandler = new SelectionHandler(map, markersLayer, linesLayer, searchResultsLayer, overpassLayer).enable()

	selectionHandler.on("fmChangeSelection", (event: any) => {
		const selection = selectionHandler.getSelection();
		mapContext.selection = selection;

		if (event.open) {
			setTimeout(() => {
				mapContext.emit("open-selection", { selection });
			}, 0);
		}
	});

	selectionHandler.on("fmLongClick", (event: any) => {
		mapContext.emit("map-long-click", { point: { lat: event.latlng.lat, lon: event.latlng.lng } });
	});

	onScopeDispose(() => {
		selectionHandler.disable();
	});

	return selectionHandler;
}

function createHashHandler(map: Map, client: Client, context: Context, mapContext: MapContextWithoutComponents, overpassLayer: OverpassLayer): HashHandler {
	const hashHandler = new HashHandler(map, client, { overpassLayer, simulate: !context.updateHash })
		.on("fmQueryChange", async (e: any) => {
			let smooth = true;
			if (!mapContext.components) {
				// This is called while the hash handler is being enabled, so it is the initial view
				smooth = false;
				await new Promise((resolve) => { setTimeout(resolve); });
			}

			if (!e.query)
				mapContext.emit("search-set-query", { query: "", zoom: false, smooth: false });
			else if (!await openSpecialQuery(e.query, context, client, mapContext as WritableMapContext, e.zoom, smooth))
				mapContext.emit("search-set-query", { query: e.query, zoom: e.zoom, smooth });
		})
		.enable();

	hashHandler.on("fmHash", (e: any) => {
		mapContext.hash = e.hash;
	});

	onScopeDispose(() => {
		hashHandler.disable();
	});

	return hashHandler;
}

function createMapComponents(client: Client, context: Context, mapContext: MapContextWithoutComponents, mapRef: Ref<HTMLElement>, innerContainerRef: Ref<HTMLElement>): MapComponents {
	const map = createMap(mapRef.value!, mapContext);
	const bboxHandler = createBboxHandler(map, client);
	const graphicScale = createGraphicScale(map);
	const linesLayer = createLinesLayer(map, client);
	const locateControl = createLocateControl(map);
	const markersLayer = createMarkersLayer(map, client);
	const mousePosition = createMousePosition(map);
	const overpassLayer = createOverpassLayer(map, mapContext);
	const searchResultsLayer = createSearchResultsLayer(map);
	const selectionHandler = createSelectionHandler(map, mapContext, markersLayer, linesLayer, searchResultsLayer, overpassLayer);
	const hashHandler = createHashHandler(map, client, context, mapContext, overpassLayer);

	const mapComponents: MapComponents = {
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
			mapComponents.container = innerContainerRef.value;
		}
	});

	return mapComponents;
}

export async function createMapContext(client: Client, context: Context, mapRef: Ref<HTMLElement>, innerContainerRef: Ref<HTMLElement>): Promise<WritableMapContext> {
	const mapContextWithoutComponents: MapContextWithoutComponents = reactive(Object.assign(mitt<MapContextEvents>(), {
		center: latLng(0, 0),
		zoom: 1,
		bounds: latLngBounds([0, 0], [0, 0]),
		layers: { baseLayer: "", overlays: [] },
		filter: undefined,
		filterFunc: () => true,
		hash: location.hash.replace(/^#/, ""),
		showToolbox: false,
		selection: [],
		activeQuery: undefined,
		fallbackQuery: undefined,
		setFallbackQuery: (query) => {
			mapContext.fallbackQuery = query;
		},
		interaction: false,
		loading: 0,
		overpassIsCustom: false,
		overpassPresets: [],
		overpassCustom: "",
		overpassMessage: undefined
	} satisfies Omit<MapContextData, 'components'>));

	const mapContext: WritableMapContext = Object.assign(mapContextWithoutComponents, {
		components: createMapComponents(client, context, mapContextWithoutComponents, mapRef, innerContainerRef)
	});

	const map = mapContext.components.map;
	const overpassLayer = mapContext.components.overpassLayer;

	if (!map._loaded) {
		try {
			// Initial view was not set by hash handler
			displayView(map, await getInitialView(client), { overpassLayer });
		} catch (error) {
			console.error(error);
			displayView(map, undefined, { overpassLayer });
		}
	}

	watch([
		() => mapContext.selection,
		() => mapContext.fallbackQuery
	], () => {
		mapContext.activeQuery = getHashQuery(mapContext.components.map, client, mapContext.selection) || mapContext.fallbackQuery;
		mapContext.components.hashHandler.setQuery(mapContext.activeQuery);
	});

	// TODO: Check if these are set by map event handlers already
	/* Object.assign(mapContext, {
		center: map._loaded ? map.getCenter() : L.latLng(0, 0),
		zoom: map._loaded ? map.getZoom() : 1,
		bounds: map._loaded ? map.getBounds() : L.latLngBounds([0, 0], [0, 0]),
		layers: getVisibleLayers(map),
		filter: map.fmFilter,
		filterFunc: map.fmFilterFunc,
		hash: location.hash.replace(/^#/, "")
	}); */

	return mapContext;
}

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