import { type Ref, ref, watch, markRaw, reactive, watchEffect, shallowRef, shallowReadonly, type Raw } from "vue";
import { type Control, latLng, latLngBounds, type Map, map as leafletMap, DomUtil, control } from "leaflet";
import "leaflet/dist/leaflet.css";
import { BboxHandler, getSymbolHtml, getVisibleLayers, HashHandler, LinesLayer, MarkersLayer, SearchResultsLayer, OverpassLayer, OverpassLoadStatus, displayView, getInitialView, coreSymbolList } from "facilmap-leaflet";
import "leaflet.locatecontrol";
import "leaflet.locatecontrol/dist/L.Control.Locate.css";
import "leaflet-graphicscale";
import "leaflet-graphicscale/dist/Leaflet.GraphicScale.min.css";
import "leaflet-mouse-position";
import "leaflet-mouse-position/src/L.Control.MousePosition.css";
import SelectionHandler from "../../utils/selection";
import { getHashQuery, openSpecialQuery } from "../../utils/zoom";
import mitt from "mitt";
import type { MapComponents, MapContextData, MapContextEvents, WritableMapContext } from "../facil-map-context-provider/map-context";
import type { ClientContext } from "../facil-map-context-provider/client-context";
import type { FacilMapContext } from "../facil-map-context-provider/facil-map-context";
import { requireClientContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
import { type Optional, sleep } from "facilmap-utils";

type MapContextWithoutComponents = Optional<WritableMapContext, 'components'>;
type OnCleanup = (cleanupFn: () => void) => void;

function useMap(element: Ref<HTMLElement>, mapContext: MapContextWithoutComponents): Ref<Raw<Map>> {
	const mapRef = shallowRef(undefined as any as Map);
	const interaction = ref(0);

	watchEffect((onCleanup) => {
		const map = mapRef.value = markRaw(leafletMap(element.value, { boxZoom: false }));

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

		onCleanup(() => {
			map.remove();
		});
	});

	watch(() => interaction.value, () => {
		mapContext.interaction = interaction.value > 0;
	}, { immediate: true });

	return mapRef;
}

function useMapComponent<T>(
	map: Ref<Map>,
	construct: () => T,
	activate: (component: T, onCleanup: OnCleanup) => void
): Ref<T> {
	const componentRef = shallowRef(undefined as any as T);
	watchEffect(() => {
		componentRef.value = construct();
	});

	watch([
		componentRef,
		map
	], ([component], prev, onCleanup) => {
		activate(component as T, onCleanup);
	}, { immediate: true });

	return componentRef;
}

function useBboxHandler(map: Ref<Map>, client: Ref<ClientContext>): Ref<Raw<BboxHandler>> {
	return useMapComponent(
		map,
		() => markRaw(new BboxHandler(map.value, client.value)),
		(bboxHandler, onCleanup) => {
			bboxHandler.enable();
			onCleanup(() => {
				bboxHandler.disable();
			});
		}
	);
}

function useGraphicScale(map: Ref<Map>): Ref<Raw<any>> {
	return useMapComponent(
		map,
		() => markRaw(control.graphicScale({ fill: "hollow", position: "bottomcenter" })),
		(graphicScale, onCleanup) => {
			graphicScale.addTo(map.value);
			onCleanup(() => {
				graphicScale.remove();
			});
		}
	);
}

function useLinesLayer(map: Ref<Map>, client: Ref<ClientContext>): Ref<Raw<LinesLayer>> {
	return useMapComponent(
		map,
		() => markRaw(new LinesLayer(client.value)),
		(linesLayer, onCleanup) => {
			linesLayer.addTo(map.value);
			onCleanup(() => {
				linesLayer.remove();
			});
		}
	);
}

function useLocateControl(map: Ref<Map>): Ref<Raw<Control.Locate>> {
	return useMapComponent(
		map,
		() => markRaw(control.locate({ flyTo: true, icon: "a", iconLoading: "a", markerStyle: { pane: "fm-raised-marker", zIndexOffset: 10000 } })),
		(locateControl, onCleanup) => {
			locateControl.addTo(map.value);

			if (!coreSymbolList.includes("screenshot")) {
				console.warn(`Icon "screenshot" is not in core icons.`);
			}

			getSymbolHtml("currentColor", "1.5em", "screenshot").then((html) => {
				locateControl._container.querySelector("a")?.insertAdjacentHTML("beforeend", html);
			}).catch((err) => {
				console.error("Error loading locate control icon", err);
			});

			onCleanup(() => {
				locateControl.remove();
			});
		}
	);
}

function useMarkersLayer(map: Ref<Map>, client: Ref<ClientContext>): Ref<Raw<MarkersLayer>> {
	return useMapComponent(
		map,
		() => markRaw(new MarkersLayer(client.value)),
		(markersLayer, onCleanup) => {
			markersLayer.addTo(map.value);
			onCleanup(() => {
				markersLayer.remove();
			});
		}
	);
}

function useMousePosition(map: Ref<Map>): Ref<Raw<Control.MousePosition>> {
	return useMapComponent(
		map,
		() => markRaw(control.mousePosition({ emptyString: "0, 0", separator: ", ", position: "bottomright" })),
		(mousePosition, onCleanup) => {
			mousePosition.addTo(map.value);
			onCleanup(() => {
				mousePosition.remove();
			});
		}
	);
}

function useOverpassLayer(map: Ref<Map>, mapContext: MapContextWithoutComponents): Ref<Raw<OverpassLayer>> {
	return useMapComponent(
		map,
		() => markRaw(new OverpassLayer([], { markerShape: "rectangle-marker" }))
			.on("setQuery", ({ query }: any) => {
				mapContext.overpassIsCustom = typeof query == "string";
				if (mapContext.overpassIsCustom)
					mapContext.overpassCustom = query && typeof query == "string" ? query : "";
				else
					mapContext.overpassPresets = Array.isArray(query) ? query : [];
			})
			.on("loadstart", () => {
				mapContext.loading++;
			})
			.on("loadend", ({ status, error }: any) => {
				mapContext.loading--;

				if (status == OverpassLoadStatus.COMPLETE)
					mapContext.overpassMessage = undefined;
				else if (status == OverpassLoadStatus.INCOMPLETE)
					mapContext.overpassMessage = "Not all POIs are shown because there are too many results. Zoom in to show all results.";
				else if (status == OverpassLoadStatus.TIMEOUT)
					mapContext.overpassMessage = "Zoom in to show POIs.";
				else if (status == OverpassLoadStatus.ERROR)
					mapContext.overpassMessage = "Error loading POIs: " + error.message;
			})
			.on("clear", () => {
				mapContext.overpassMessage = undefined;
			}),
		(overpassLayer, onCleanup) => {
			overpassLayer.addTo(map.value)
			onCleanup(() => {
				overpassLayer.remove();
			});
		}
	);
}

function useSearchResultsLayer(map: Ref<Map>): Ref<Raw<SearchResultsLayer>> {
	return useMapComponent(
		map,
		() => markRaw(new SearchResultsLayer(undefined, { pathOptions: { weight: 7 } })),
		(searchResultsLayer, onCleanup) => {
			searchResultsLayer.addTo(map.value);
			onCleanup(() => {
				searchResultsLayer.remove();
			});
		}
	);
}

function useSelectionHandler(map: Ref<Map>, context: FacilMapContext, mapContext: MapContextWithoutComponents, markersLayer: Ref<MarkersLayer>, linesLayer: Ref<LinesLayer>, searchResultsLayer: Ref<SearchResultsLayer>, overpassLayer: Ref<OverpassLayer>): Ref<Raw<SelectionHandler>> {
	return useMapComponent(
		map,
		() => {
			const selectionHandler = markRaw(new SelectionHandler(map.value, markersLayer.value, linesLayer.value, searchResultsLayer.value, overpassLayer.value));

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
				context.components.clickMarkerTab?.openClickMarker({ lat: event.latlng.lat, lon: event.latlng.lng });
			});

			return selectionHandler;
		},
		(selectionHandler, onCleanup) => {
			selectionHandler.enable();
			onCleanup(() => {
				selectionHandler.disable();
			});
		}
	);
}

function useHashHandler(map: Ref<Map>, client: Ref<ClientContext>, context: FacilMapContext, mapContext: MapContextWithoutComponents, overpassLayer: Ref<OverpassLayer>): Ref<Raw<HashHandler>> {
	return useMapComponent(
		map,
		() => markRaw(new HashHandler(map.value, client.value, { overpassLayer: overpassLayer.value, simulate: !context.settings.updateHash }))
			.on("fmQueryChange", async (e: any) => {
				let smooth = true;
				let autofocus = false;
				if (!mapContext.components) {
					// This is called while the hash handler is being enabled, so it is the initial view
					smooth = false;
					autofocus = context.settings.autofocus;
					await sleep(0); // Wait for components to be initialized (needed by openSpecialQuery())
				}

				const searchFormTab = context.components.searchFormTab;
				if (!e.query)
					searchFormTab?.setQuery("", false, false);
				else if (!await openSpecialQuery(e.query, context, e.zoom, smooth))
					searchFormTab?.setQuery(e.query, e.zoom, smooth, autofocus);
			})
			.on("fmHash", (e: any) => {
				mapContext.hash = e.hash;
			}),
		(hashHandler, onCleanup) => {
			hashHandler.enable();
			onCleanup(() => {
				hashHandler.disable();
			});
		}
	);
}

function useMapComponents(context: FacilMapContext, mapContext: MapContextWithoutComponents, mapRef: Ref<HTMLElement>, innerContainerRef: Ref<HTMLElement>): MapComponents {
	const client = requireClientContext(context);
	const map = useMap(mapRef, mapContext);
	const bboxHandler = useBboxHandler(map, client);
	const graphicScale = useGraphicScale(map);
	const linesLayer = useLinesLayer(map, client);
	const locateControl = useLocateControl(map);
	const markersLayer = useMarkersLayer(map, client);
	const mousePosition = useMousePosition(map);
	const overpassLayer = useOverpassLayer(map, mapContext);
	const searchResultsLayer = useSearchResultsLayer(map);
	const selectionHandler = useSelectionHandler(map, context, mapContext, markersLayer, linesLayer, searchResultsLayer, overpassLayer);
	const hashHandler = useHashHandler(map, client, context, mapContext, overpassLayer);

	const components: MapComponents = reactive({
		map: map,
		bboxHandler: bboxHandler,
		graphicScale: graphicScale,
		linesLayer: linesLayer,
		locateControl: locateControl,
		markersLayer: markersLayer,
		mousePosition: mousePosition,
		overpassLayer: overpassLayer,
		searchResultsLayer: searchResultsLayer,
		selectionHandler: selectionHandler,
		hashHandler: hashHandler,
		container: innerContainerRef
	});

	return shallowReadonly(components);
}

export async function useMapContext(context: FacilMapContext, mapRef: Ref<HTMLElement>, innerContainerRef: Ref<HTMLElement>): Promise<WritableMapContext> {
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
		overpassMessage: undefined,
		loaded: false,
		fatalError: undefined
	} satisfies Omit<MapContextData, 'components'>));

	const mapContext: WritableMapContext = Object.assign(mapContextWithoutComponents, {
		components: useMapComponents(context, mapContextWithoutComponents, mapRef, innerContainerRef)
	});

	const map = mapContext.components.map;
	const overpassLayer = mapContext.components.overpassLayer;

	const client = requireClientContext(context);

	if (!map._loaded) {
		try {
			// Initial view was not set by hash handler
			displayView(map, await getInitialView(client.value), { overpassLayer });
		} catch (error) {
			console.error(error);
			displayView(map, undefined, { overpassLayer });
		}
	}

	watchEffect(() => {
		mapContext.activeQuery = getHashQuery(mapContext.components.map, client.value, mapContext.selection) || mapContext.fallbackQuery;
		mapContext.components.hashHandler.setQuery(mapContext.activeQuery);
	});

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