import { type Ref, ref, watch, markRaw, reactive, watchEffect, shallowRef, shallowReadonly, type Raw, nextTick } from "vue";
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
import { type Optional } from "facilmap-utils";
import { getI18n, i18nResourceChangeCounter } from "../../utils/i18n";
import { AttributionControl } from "./attribution";
import { fixOnCleanup } from "../../utils/vue";

type MapContextWithoutComponents = Optional<WritableMapContext, 'components'>;
type OnCleanup = (cleanupFn: () => void) => void;

function useMap(element: Ref<HTMLElement>, mapContext: MapContextWithoutComponents): Ref<Raw<Map>> {
	const mapRef = shallowRef(undefined as any as Map);
	const interaction = ref(0);

	watchEffect((onCleanup) => {
		const map = mapRef.value = markRaw(leafletMap(element.value, { boxZoom: false, attributionControl: false }));

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

		map.on("locationfound", (data) => {
			mapContext.location = { lat: data.latlng.lat, lon: data.latlng.lng };
		});

		const stopLocate = map.stopLocate;
		map.stopLocate = function() {
			mapContext.location = undefined;
			return stopLocate.call(this);
		};

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
	], ([component], prev, onCleanup_) => {
		const onCleanup = fixOnCleanup(onCleanup_);
		activate(component as T, onCleanup);
	}, { immediate: true });

	return componentRef;
}

function useAttribution(map: Ref<Map>): Ref<Raw<AttributionControl>> {
	return useMapComponent(
		map,
		() => markRaw(new AttributionControl()),
		(attribution, onCleanup) => {
			map.value.addControl(attribution);

			const i18nWatcher = watch(i18nResourceChangeCounter, () => {
				attribution.update();
			});
			onCleanup(() => {
				i18nWatcher();
			});
		}
	);
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

function useLocateControl(map: Ref<Map>, context: FacilMapContext): Ref<Raw<Control.Locate> | undefined> {
	return useMapComponent(
		map,
		() => {
			if (context.settings.locate) {
				return markRaw(control.locate({
					flyTo: true,
					icon: "a",
					iconLoading: "a",
					markerStyle: { pane: "fm-raised-marker", zIndexOffset: 10000 },
					locateOptions: {
						enableHighAccuracy: true
					},
					clickBehavior: {
						inView: "stop",
						outOfView: "setView",
						inViewNotFollowing: "outOfView"
					}
				}));
			}
		},
		(locateControl, onCleanup) => {
			if (locateControl) {
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
					mapContext.overpassMessage = getI18n().t("leaflet-map-components.pois-too-many-results");
				else if (status == OverpassLoadStatus.TIMEOUT)
					mapContext.overpassMessage = getI18n().t("leaflet-map-components.pois-zoom-in");
				else if (status == OverpassLoadStatus.ERROR)
					mapContext.overpassMessage = getI18n().t("leaflet-map-components.pois-error", { message: error.message });
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
				void context.components.clickMarkerTab?.openClickMarker({ lat: event.latlng.lat, lon: event.latlng.lng });
			});

			selectionHandler.on("fmLongClickAbort", () => {
				context.components.clickMarkerTab?.closeLastClickMarker();
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

function useHashHandler(map: Ref<Map>, client: Ref<ClientContext>, context: FacilMapContext, mapContext: MapContextWithoutComponents, overpassLayer: Ref<OverpassLayer>): Ref<Raw<HashHandler & { _fmActivate: () => Promise<void> }>> {
	return useMapComponent(
		map,
		() => {
			let queryChangePromise: Promise<void> | undefined;
			const hashHandler = markRaw(new HashHandler(map.value, client.value, { overpassLayer: overpassLayer.value, simulate: !context.settings.updateHash }))
				.on("fmQueryChange", async (e: any) => {
					let smooth = true;
					let autofocus = false;

					const searchFormTab = context.components.searchFormTab;
					queryChangePromise = (async () => {
						if (!e.query)
							await searchFormTab?.setQuery("", false, false);
						else if (!await openSpecialQuery(e.query, context, e.zoom, smooth))
							await searchFormTab?.setQuery(e.query, e.zoom, smooth, autofocus);
					})();
					await queryChangePromise;
				})
				.on("fmHash", (e: any) => {
					mapContext.hash = e.hash;
				});
			return Object.assign(hashHandler, {
				_fmActivate: async () => {
					hashHandler.enable();
					await queryChangePromise;
				}
			});
		},
		(hashHandler, onCleanup) => {
			onCleanup(() => {
				hashHandler.disable();
			});
		}
	);
}

function useMapComponents(context: FacilMapContext, mapContext: MapContextWithoutComponents, mapRef: Ref<HTMLElement>, innerContainerRef: Ref<HTMLElement>): MapComponents {
	const client = requireClientContext(context);
	const map = useMap(mapRef, mapContext);
	const attribution = useAttribution(map);
	const bboxHandler = useBboxHandler(map, client);
	const graphicScale = useGraphicScale(map);
	const linesLayer = useLinesLayer(map, client);
	const locateControl = useLocateControl(map, context);
	const markersLayer = useMarkersLayer(map, client);
	const mousePosition = useMousePosition(map);
	const overpassLayer = useOverpassLayer(map, mapContext);
	const searchResultsLayer = useSearchResultsLayer(map);
	const selectionHandler = useSelectionHandler(map, context, mapContext, markersLayer, linesLayer, searchResultsLayer, overpassLayer);
	const hashHandler = useHashHandler(map, client, context, mapContext, overpassLayer);

	const components: MapComponents = reactive({
		map,
		attribution,
		bboxHandler,
		graphicScale,
		linesLayer,
		locateControl,
		markersLayer,
		mousePosition,
		overpassLayer,
		searchResultsLayer,
		selectionHandler,
		hashHandler,
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
		location: undefined,
		loaded: false,
		fatalError: undefined,
		runOperation: async (operation) => {
			try {
				mapContextWithoutComponents.loading++;
				return await operation();
			} finally {
				mapContextWithoutComponents.loading--;
			}
		}
	} satisfies Omit<MapContextData, 'components'>));

	const mapContext: WritableMapContext = Object.assign(mapContextWithoutComponents, {
		components: useMapComponents(context, mapContextWithoutComponents, mapRef, innerContainerRef)
	});

	const map = mapContext.components.map;
	const overpassLayer = mapContext.components.overpassLayer;

	const client = requireClientContext(context);

	(async () => {
		await nextTick(); // useMapContext() return promise is resolved, setting mapContext.value in <LeafletMap>
		await nextTick(); // <LeafletMap> rerenders with its slot, search box tabs are now available and can receive the query from the hash handler

		await mapContext.components.hashHandler._fmActivate();

		if (!map._loaded) {
			try {
				// Initial view was not set by hash handler
				displayView(map, await getInitialView(client.value), { overpassLayer });
			} catch (error) {
				console.error(error);
				displayView(map, undefined, { overpassLayer });
			}
		}

		watch(() => mapContext.components.hashHandler, async (hashHandler) => {
			await hashHandler._fmActivate();
		});

		watchEffect(() => {
			mapContext.activeQuery = getHashQuery(mapContext.components.map, client.value, mapContext.selection) || mapContext.fallbackQuery;
			mapContext.components.hashHandler.setQuery(mapContext.activeQuery);
		});
	})().catch(console.error);

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