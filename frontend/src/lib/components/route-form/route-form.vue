<script setup lang="ts">
	import { computed, markRaw, nextTick, reactive, ref, toRaw, watch } from "vue";
	import Icon from "../ui/icon.vue";
	import { decodeRouteQuery, encodeRouteQuery, formatCoordinates, formatDistance, formatRouteMode, formatRouteTime, formatTypeName, isSearchId, normalizeMarkerName } from "facilmap-utils";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import type { ExportFormat, FindOnMapResult, SearchResult } from "facilmap-types";
	import { getMarkerIcon, type HashQuery, MarkerLayer, RouteLayer } from "facilmap-leaflet";
	import { getZoomDestinationForRoute, flyTo, normalizeZoomDestination } from "../../utils/zoom";
	import { latLng, type LatLng } from "leaflet";
	import Draggable from "vuedraggable";
	import RouteMode from "../ui/route-mode.vue";
	import DraggableLines from "leaflet-draggable-lines";
	import { cloneDeep, throttle } from "lodash-es";
	import ElevationStats from "../ui/elevation-stats.vue";
	import ElevationPlot from "../ui/elevation-plot.vue";
	import { isMapResult } from "../../utils/search";
	import type { LineWithTags } from "../../utils/add";
	import vTooltip from "../../utils/tooltip";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import ZoomToObjectButton from "../ui/zoom-to-object-button.vue";
	import { UseAsType, type RouteDestination } from "../facil-map-context-provider/route-form-tab-context";
	import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import AddToMapDropdown from "../ui/add-to-map-dropdown.vue";
	import ExportDropdown from "../ui/export-dropdown.vue";
	import { useI18n } from "../../utils/i18n";
	import { mapRef, useIsMounted } from "../../utils/vue";

	type SearchSuggestion = SearchResult;
	type MapSuggestion = FindOnMapResult & { kind: "marker" };
	type Suggestion = SearchSuggestion | MapSuggestion;

	interface Destination extends RouteDestination {
		query: string;
		loadingQuery?: string;
		loadingPromise?: Promise<void>;
		loadedQuery?: string;
		searchSuggestions?: SearchSuggestion[];
		mapSuggestions?: MapSuggestion[];
		selectedSuggestion?: Suggestion;
	}

	function makeCoordDestination(latlng: LatLng) {
		const disp = formatCoordinates({ lat: latlng.lat, lon: latlng.lng });
		let suggestion = {
			lat: latlng.lat,
			lon: latlng.lng,
			display_name: disp,
			short_name: disp,
			type: "coordinates",
			id: disp
		};
		return {
			query: disp,
			loadingQuery: disp,
			loadedQuery: disp,
			selectedSuggestion: suggestion,
			searchSuggestions: [ suggestion ]
		};
	}

	function makeDestination({ query, searchSuggestions, mapSuggestions, selectedSuggestion }: { query: string; searchSuggestions?: SearchResult[]; mapSuggestions?: FindOnMapResult[]; selectedSuggestion?: SearchResult | FindOnMapResult }): Destination {
		return {
			query,
			loadedQuery: searchSuggestions || mapSuggestions ? query : undefined,
			searchSuggestions,
			mapSuggestions: mapSuggestions?.filter((result) => result.kind == "marker") as MapSuggestion[],
			selectedSuggestion: selectedSuggestion as MapSuggestion
		};
	}

	const startMarkerColour = "00ff00";
	const dragMarkerColour = "ffd700";
	const endMarkerColour = "ff0000";

	function getIcon(i: number, length: number, highlight = false) {
		return getMarkerIcon(i == 0 ? `#${startMarkerColour}` : i == length - 1 ? `#${endMarkerColour}` : `#${dragMarkerColour}`, 35, undefined, undefined, highlight);
	}

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);

	const toasts = useToasts();
	const i18n = useI18n();

	const inputRefs = reactive(new Map<number, HTMLInputElement>());
	const submitButton = ref<HTMLButtonElement>();

	const props = withDefaults(defineProps<{
		/** If false, the route layer will be opaque and not draggable. */
		active?: boolean;
		routeId?: string;
		showToolbar?: boolean;
		noClear?: boolean;
	}>(), {
		active: true,
		showToolbar: true
	});

	const emit = defineEmits<{
		activate: [];
		"hash-query-change": [hashQuery: HashQuery | undefined];
	}>();

	const routeObj = computed(() => props.routeId ? client.value.routes[props.routeId] : client.value.route);
	const hasRoute = computed(() => !!routeObj.value);

	const routeMode = ref(routeObj.value?.mode ?? "car");
	const destinations = ref<Destination[]>(routeObj.value ? (
		routeObj.value.routePoints.map((point) => makeCoordDestination(latLng(point.lat, point.lon)))
	) : (
		[{ query: "" }, { query: "" }]
	));
	const submittedQuery = ref<{ destinations: Destination[]; mode: string }>();
	const routeError = ref<string>();
	const hoverDestinationIdx = ref<number>();
	const hoverInsertIdx = ref<number>();
	const suggestionMarker = ref<MarkerLayer>();

	const routeLayer = computed(() => {
		const layer = markRaw(new RouteLayer(client.value, props.routeId, { weight: 7, opacity: 1, raised: true }));
		layer.on("click", (e) => {
			if (!props.active && !(e.originalEvent as any).ctrlKey) {
				emit("activate");
			}
		});
		return layer;
	});

	const draggable = computed(() => {
		const draggable = markRaw(new DraggableLines(mapContext.value.components.map, {
			enableForLayer: false,
			tempMarkerOptions: () => ({
				icon: getMarkerIcon(`#${dragMarkerColour}`, 35),
				pane: "fm-raised-marker"
			}),
			plusTempMarkerOptions: () => ({
				icon: getMarkerIcon(`#${dragMarkerColour}`, 35),
				pane: "fm-raised-marker"
			}),
			dragMarkerOptions: (layer, i, length) => ({
				icon: getIcon(i, length),
				pane: "fm-raised-marker"
			})
		}));

		draggable.on({
			insert: (e: any) => {
				destinations.value.splice(e.idx, 0, makeCoordDestination(e.latlng));
				void reroute(false);
			},
			dragstart: (e: any) => {
				hoverDestinationIdx.value = e.idx;
				hoverInsertIdx.value = undefined;
				if (e.isNew)
					destinations.value.splice(e.idx, 0, makeCoordDestination(e.to));
			},
			drag: throttle((e: any) => {
				destinations.value[e.idx] = makeCoordDestination(e.to);
			}, 300),
			dragend: (e: any) => {
				destinations.value[e.idx] = makeCoordDestination(e.to);
				void reroute(false);
			},
			remove: (e: any) => {
				hoverDestinationIdx.value = undefined;
				destinations.value.splice(e.idx, 1);
				void reroute(false);
			},
			dragmouseover: (e: any) => {
				destinationMouseOver(e.idx);
			},
			dragmouseout: (e: any) => {
				destinationMouseOut(e.idx);
			},
			plusmouseover: (e: any) => {
				hoverInsertIdx.value = e.idx;
			},
			plusmouseout: (e: any) => {
				hoverInsertIdx.value = undefined;
			},
			tempmouseover: (e: any) => {
				hoverInsertIdx.value = e.idx;
			},
			tempmousemove: (e: any) => {
				if (e.idx != hoverInsertIdx.value)
					hoverInsertIdx.value = e.idx;
			},
			tempmouseout: (e: any) => {
				hoverInsertIdx.value = undefined;
			}
		} as any);

		return draggable;
	});

	const isMounted = useIsMounted();
	watch([isMounted, draggable], (v, o, onCleanup) => {
		if (isMounted.value) {
			draggable.value.enable();

			onCleanup(() => {
				draggable.value.disable();
			});
		}
	});
	watch([isMounted, routeLayer, () => mapContext.value.components.map], (v, o, onCleanup) => {
		if (isMounted.value) {
			routeLayer.value.addTo(mapContext.value.components.map);

			onCleanup(() => {
				routeLayer.value.remove();
			});
		}
	});

	watch([hasRoute, () => props.active, draggable, routeLayer], () => {
		if (hasRoute.value)
			routeLayer.value.setStyle({ opacity: props.active ? 1 : 0.35, raised: props.active });

		// Enable dragging after updating the style, since that might re-add the layer to the map
		if (props.active) {
			draggable.value.enableForLayer(routeLayer.value);
		} else {
			draggable.value.disableForLayer(routeLayer.value);
		}
	});

	const zoomDestination = computed(() => routeObj.value && getZoomDestinationForRoute(routeObj.value));

	const hashQuery = computed(() => {
		if (submittedQuery.value) {
			return {
				query: encodeRouteQuery({
					queries: submittedQuery.value.destinations.map((dest) => (getSelectedSuggestionId(dest) ?? dest.query)),
					mode: submittedQuery.value.mode
				}),
				...(zoomDestination.value ? normalizeZoomDestination(mapContext.value.components.map, zoomDestination.value) : {}),
				description: i18n.t("route-form.route-description-outer", {
					inner: i18n.t("route-form.route-description-inner", {
						destinations: submittedQuery.value.destinations.map((dest) => (getSelectedSuggestionName(dest) ?? dest.query)).join(i18n.t("route-form.route-description-inner-joiner")),
						mode: formatRouteMode(submittedQuery.value.mode)
					})
				})
			};
		} else
			return undefined;
	});

	const destinationsMeta = computed(() => destinations.value.map((destination) => ({
		isInvalid: getValidationState(destination) === false
	})));

	watch(hashQuery, (hashQuery) => {
		emit("hash-query-change", hashQuery);
	});

	watch(routeMode, () => {
		void reroute(false);
	});

	function addDestination(): void {
		destinations.value.push({
			query: ""
		});
	}

	function removeDestination(idx: number): void {
		if (destinations.value.length > 2)
			destinations.value.splice(idx, 1);
	}

	function getSelectedSuggestion(dest: Destination): Suggestion | undefined {
		if(dest.selectedSuggestion && [...(dest.searchSuggestions || []), ...(dest.mapSuggestions || [])].includes(dest.selectedSuggestion))
			return dest.selectedSuggestion;
		else if(dest.mapSuggestions && dest.mapSuggestions.length > 0 && (dest.mapSuggestions[0].similarity == 1 || (dest.searchSuggestions || []).length == 0))
			return dest.mapSuggestions[0];
		else if((dest.searchSuggestions || []).length > 0)
			return dest.searchSuggestions![0];
		else
			return undefined;
	}

	function getSelectedSuggestionId(dest: Destination): string | undefined {
		const sugg = getSelectedSuggestion(dest);
		if (!sugg)
			return undefined;

		if (isMapResult(sugg))
			return (sugg.kind == "marker" ? "m" : "l") + sugg.id;
		else
			return sugg.id;
	}

	function getSelectedSuggestionName(dest: Destination): string | undefined {
		const sugg = getSelectedSuggestion(dest);
		if (!sugg)
			return undefined;

		if (isMapResult(sugg))
			return sugg.name;
		else
			return sugg.short_name;
	}

	async function loadSuggestions(dest: Destination): Promise<void> {
		if (dest.loadingQuery == dest.query.trim()) {
			await dest.loadingPromise;
			return;
		} else if (dest.loadedQuery == dest.query.trim())
			return;

		const idx = destinations.value.indexOf(dest);
		toasts.hideToast(`fm${context.id}-route-form-suggestion-error-${idx}`);
		dest.searchSuggestions = undefined;
		dest.mapSuggestions = undefined;
		dest.selectedSuggestion = undefined;
		dest.loadingQuery = undefined;
		dest.loadingPromise = undefined;
		dest.loadedQuery = undefined;

		const query = dest.query.trim();

		if(query != "") {
			dest.loadingQuery = query;
			let resolveLoadingPromise = (): void => undefined;
			dest.loadingPromise = new Promise((resolve) => { resolveLoadingPromise = resolve; });

			try {
				const [searchResults, mapResults] = await Promise.all([
					client.value.find({ query: query }),
					(async () => {
						if (client.value.mapData) {
							const m = query.match(/^m(\d+)$/);
							if (m) {
								const marker = await client.value.getMarker({ id: Number(m[1]) });
								return marker ? [{ kind: "marker" as const, similarity: 1, ...marker }] : [];
							} else
								return (await client.value.findOnMap({ query })).filter((res) => res.kind == "marker") as MapSuggestion[];
						}
					})()
				])

				if(query != dest.loadingQuery)
					return; // The destination has changed in the meantime

				dest.loadingQuery = undefined;
				dest.loadedQuery = query;
				dest.searchSuggestions = searchResults;
				dest.mapSuggestions = mapResults;

				if(isSearchId(query) && searchResults.length > 0 && searchResults[0].display_name) {
					if (dest.query == query)
						dest.query = searchResults[0].display_name;
					dest.loadedQuery = searchResults[0].display_name;
					dest.selectedSuggestion = searchResults[0];
				}

				if(mapResults) {
					const referencedMapResult = mapResults.find((res) => query == `m${res.id}`);
					if(referencedMapResult) {
						if (dest.query == query)
							dest.query = normalizeMarkerName(referencedMapResult.name);
						dest.loadedQuery = normalizeMarkerName(referencedMapResult.name);
						dest.selectedSuggestion = referencedMapResult;
					}
				}

				if(dest.selectedSuggestion == null)
					dest.selectedSuggestion = getSelectedSuggestion(dest);
			} catch (err: any) {
				if(query != dest.loadingQuery)
					return; // The destination has changed in the meantime

				console.warn(err.stack || err);
				toasts.showErrorToast(`fm${context.id}-route-form-suggestion-error-${idx}`, () => i18n.t("route-form.find-destination-error", { query }), err);
			} finally {
				resolveLoadingPromise();
			}
		}
	}

	function suggestionMouseOver(suggestion: Suggestion): void {
		suggestionMarker.value = markRaw((new MarkerLayer([ suggestion.lat!, suggestion.lon! ], {
			highlight: true,
			marker: {
				colour: dragMarkerColour,
				size: 35,
				icon: "",
				shape: "drop"
			}
		})).addTo(mapContext.value.components.map));
	}

	function suggestionMouseOut(): void {
		if(suggestionMarker.value) {
			suggestionMarker.value.remove();
			suggestionMarker.value = undefined;
		}
	}

	function suggestionZoom(suggestion: Suggestion): void {
		mapContext.value.components.map.flyTo([suggestion.lat!, suggestion.lon!]);
	}

	function destinationMouseOver(idx: number): void {
		const marker = routeLayer.value._draggableLines?.dragMarkers[idx];

		if (marker) {
			hoverDestinationIdx.value = idx;
			marker.setIcon(getIcon(idx, routeLayer.value._draggableLines!.dragMarkers.length, true));
		}
	}

	function destinationMouseOut(idx: number): void {
		hoverDestinationIdx.value = undefined;

		const marker = routeLayer.value._draggableLines?.dragMarkers[idx];
		if (marker) {
			void Promise.resolve().then(() => {
				// If mouseout event is directly followed by a dragend event, the marker will be removed. Only update the icon if the marker is not removed.
				if (marker["_map"])
					marker.setIcon(getIcon(idx, routeLayer.value._draggableLines!.dragMarkers.length));
			});
		}
	}

	function getValidationState(destination: Destination): boolean | null {
		if (routeError.value && destination.query.trim() == '')
			return false;
		else if (destination.loadedQuery && destination.query == destination.loadedQuery && getSelectedSuggestion(destination) == null)
			return false;
		else
			return null;
	}

	async function route(zoom: boolean, smooth = true): Promise<void> {
		reset();

		try {
			const mode = routeMode.value;

			submittedQuery.value = { destinations: cloneDeep(toRaw(destinations.value)), mode };

			await Promise.all(destinations.value.map((dest) => loadSuggestions(dest)));
			const points = destinations.value.map((dest) => getSelectedSuggestion(dest));

			submittedQuery.value = { destinations: cloneDeep(toRaw(destinations.value)), mode };

			if(points.some((point) => point == null)) {
				routeError.value = i18n.t("route-form.some-destinations-not-found");
				return;
			}

			const route = await client.value.setRoute({
				routePoints: points.map((point) => ({ lat: point!.lat!, lon: point!.lon! })),
				mode,
				routeId: props.routeId
			});

			if (route && zoom)
				flyTo(mapContext.value.components.map, getZoomDestinationForRoute(route), smooth);
		} catch (err: any) {
			toasts.showErrorToast(`fm${context.id}-route-form-error`, () => i18n.t("route-form.route-calculation-error"), err);
		}
	}

	async function reroute(zoom: boolean, smooth = true): Promise<void> {
		if(hasRoute.value) {
			await Promise.all(destinations.value.map((dest) => loadSuggestions(dest)));
			const points = destinations.value.map((dest) => getSelectedSuggestion(dest));

			if(!points.some((point) => point == null))
				await route(zoom, smooth);
		}
	}

	function reset(): void {
		toasts.hideToast(`fm${context.id}-route-form-error`);
		submittedQuery.value = undefined;
		routeError.value = undefined;

		if(suggestionMarker.value) {
			suggestionMarker.value.remove();
			suggestionMarker.value = undefined;
		}

		client.value.clearRoute({ routeId: props.routeId });
	}

	function clear(): void {
		reset();

		destinations.value = [
			{ query: "" },
			{ query: "" }
		];
	}

	function handleSubmit(event: Event): void {
		submitButton.value?.focus();
		void route(true);
	}

	const linesWithTags = computed((): LineWithTags[] | undefined => routeObj.value && [{
		routePoints: routeObj.value.routePoints,
		mode: routeObj.value.mode
	}]);

	async function getExport(format: ExportFormat): Promise<string> {
		return await client.value.exportRoute({ format });
	}

	function setQuery(query: string, zoom = true, smooth = true): void {
		clear();
		const split = decodeRouteQuery(query);
		destinations.value = split.queries.map((query) => ({ query }));
		while (destinations.value.length < 2)
			destinations.value.push({ query: "" });
		routeMode.value = split.mode ?? "car";
		void route(zoom, smooth);
	}

	function useAs(data: Parameters<typeof makeDestination>[0], as: UseAsType): void {
		let focusIdx: number;
		const dest = makeDestination(data);

		switch (as) {
			case UseAsType.BEFORE_FROM:
				destinations.value.unshift(dest);
				focusIdx = 0;
				break;

			case UseAsType.AS_FROM:
				destinations.value[0] = dest;
				focusIdx = 0;
				break;

			case UseAsType.AFTER_FROM:
				destinations.value.splice(1, 0, dest);
				focusIdx = 1;
				break;

			case UseAsType.BEFORE_TO:
				destinations.value.splice(destinations.value.length - 1, 0, dest);
				focusIdx = destinations.value.length - 1;
				break;

			case UseAsType.AS_TO:
				destinations.value[destinations.value.length - 1] = dest;
				focusIdx = destinations.value.length - 1;
				break;

			case UseAsType.AFTER_TO:
				destinations.value.push(dest);
				focusIdx = destinations.value.length - 1;
				break;
		}

		if (focusIdx != null) {
			void nextTick(() => { // New destinations are rendered
				void nextTick(() => { // New destinations have been rendered, refs are available
					inputRefs.get(focusIdx)?.focus();
				});
			});
			void reroute(true);
		}
	}

	defineExpose({
		setQuery,
		useAs,
		hasFrom: computed(() => destinations.value[0].query.trim() != ''),
		hasTo: computed(() => destinations.value[destinations.value.length - 1].query.trim() != ''),
		hasVia: computed(() => destinations.value.length > 2)
	});
</script>

<template>
	<div class="fm-route-form">
		<form action="javascript:" @submit.prevent="handleSubmit">
			<Draggable
				v-model="destinations"
				handle=".fm-drag-handle"
				@end="reroute(true)"
				:itemKey="(destination: any) => destinations.indexOf(destination)"
			>
				<template #item="{ element: destination, index: idx }">
					<div class="destination" :class="{ active: hoverDestinationIdx == idx }">
						<hr class="fm-route-form-hover-insert" :class="{ active: hoverInsertIdx === idx }"/>
						<div
							class="input-group"
							@mouseenter="destinationMouseOver(idx)"
							@mouseleave="destinationMouseOut(idx)"
						>
							<span class="input-group-text px-2">
								<a href="javascript:" class="fm-drag-handle" @contextmenu.prevent>
									<Icon icon="resize-vertical" :alt="i18n.t('route-form.reorder-alt')"></Icon>
								</a>
							</span>
							<input
								class="form-control"
								v-model="destination.query"
								:placeholder="idx == 0 ? i18n.t('route-form.from-placeholder') : idx == destinations.length-1 ? i18n.t('route-form.to-placeholder') : i18n.t('route-form.via-placeholder')"
								:tabindex="idx+1"
								:class="{
									'is-invalid': destinationsMeta[idx].isInvalid,
									'fm-autofocus': idx === 0
								}"
								@blur="loadSuggestions(destination)"
								:ref="mapRef(inputRefs, idx)"
							/>
							<template v-if="destination.query.trim() != ''">
								<DropdownMenu
									menuClass="fm-route-form-suggestions"
									noWrapper
									@update:isOpen="$event && loadSuggestions(destination)"
									:isLoading="!destination.searchSuggestions && !destination.mapSuggestions"
								>
									<template v-for="suggestion in destination.mapSuggestions" :key="suggestion.id">
										<li
											@mouseenter="suggestionMouseOver(suggestion)"
											@mouseleave="suggestionMouseOut()"
										>
											<a
												href="javascript:"
												class="dropdown-item fm-route-form-suggestions-zoom"
												:class="{ active: suggestion === getSelectedSuggestion(destination) }"
												@click.capture.stop.prevent="suggestionZoom(suggestion)"
											><Icon icon="zoom-in" :alt="i18n.t('route-form.zoom-alt')"></Icon></a>

											<a
												href="javascript:"
												class="dropdown-item"
												:class="{ active: suggestion === getSelectedSuggestion(destination) }"
												@click="destination.selectedSuggestion = suggestion; reroute(true)"
											>{{suggestion.name}} ({{formatTypeName(client.types[suggestion.typeId].name)}})</a>
										</li>
									</template>

									<li v-if="(destination.searchSuggestions || []).length > 0 && (destination.mapSuggestions || []).length > 0">
										<hr class="dropdown-divider fm-route-form-suggestions-divider">
									</li>

									<template v-for="suggestion in destination.searchSuggestions" :key="suggestion.id">
										<li
											@mouseenter="suggestionMouseOver(suggestion)"
											@mouseleave="suggestionMouseOut()"
										>
											<a
												href="javascript:"
												class="dropdown-item fm-route-form-suggestions-zoom"
												:class="{ active: suggestion === getSelectedSuggestion(destination) }"
												@click.capture.stop.prevent="suggestionZoom(suggestion)"
											><Icon icon="zoom-in" :alt="i18n.t('route-form.zoom-alt')"></Icon></a>
											<a
												href="javascript:"
												class="dropdown-item"
												:class="{ active: suggestion === getSelectedSuggestion(destination) }"
												@click="destination.selectedSuggestion = suggestion; reroute(true)"
											>{{suggestion.display_name}}<span v-if="suggestion.type"> ({{suggestion.type}})</span></a>
										</li>
									</template>
								</DropdownMenu>
							</template>
							<button
								v-if="destinations.length > 2"
								type="button"
								class="btn btn-secondary"
								@click="removeDestination(idx); reroute(false)"
								v-tooltip.right="i18n.t('route-form.remove-destination-tooltip')"
							>
								<Icon icon="minus" :alt="i18n.t('route-form.remove-destination-alt')" size="1.0em"></Icon>
							</button>
						</div>
					</div>
				</template>
				<template #footer>
					<hr class="fm-route-form-hover-insert" :class="{ active: hoverInsertIdx === destinations.length }"/>
				</template>
			</draggable>

			<div class="btn-toolbar">
				<button
					type="button"
					class="btn btn-secondary"
					@click="addDestination()"
					v-tooltip.bottom="i18n.t('route-form.add-destination-tooltip')"
					:tabindex="destinations.length+1"
				>
					<Icon icon="plus" :alt="i18n.t('route-form.add-destination-alt')"></Icon>
				</button>

				<RouteMode v-if="context.settings.routing" v-model="routeMode" :tabindex="destinations.length+2" tooltip-placement="bottom"></RouteMode>

				<button
					type="submit"
					class="btn btn-primary flex-grow-1"
					:tabindex="destinations.length+7"
					ref="submitButton"
				>{{i18n.t("route-form.submit")}}</button>
				<button
					v-if="hasRoute && !props.noClear"
					type="button"
					class="btn btn-secondary"
					:tabindex="destinations.length+8"
					@click="reset()"
					v-tooltip.right="i18n.t('route-form.clear-route-tooltip')"
				>
					<Icon icon="remove" :alt="i18n.t('route-form.clear-route-alt')"></Icon>
				</button>
			</div>

			<template v-if="routeError">
				<hr />

				<div class="alert alert-danger">{{routeError}}</div>
			</template>

			<template v-if="routeObj">
				<hr />

				<dl class="fm-search-box-dl">
					<dt>{{i18n.t("route-form.distance")}}</dt>
					<dd>{{formatDistance(routeObj.distance)}} <span v-if="routeObj.time != null">({{formatRouteTime(routeObj.time, routeObj.mode)}})</span></dd>

					<template v-if="routeObj.ascent != null">
						<dt>{{i18n.t("route-form.ascent-descent")}}</dt>
						<dd><ElevationStats :route="routeObj"></ElevationStats></dd>
					</template>
				</dl>

				<ElevationPlot :route="routeObj" v-if="routeObj.ascent != null"></ElevationPlot>

				<div v-if="showToolbar && !client.readonly" class="btn-toolbar" role="group">
					<ZoomToObjectButton
						v-if="zoomDestination"
						:label="i18n.t('route-form.zoom-to-object-label')"
						size="sm"
						:destination="zoomDestination"
					></ZoomToObjectButton>

					<AddToMapDropdown
						:lines="linesWithTags"
						size="sm"
						isSingle
					></AddToMapDropdown>

					<ExportDropdown
						:filename="i18n.t('route-form.export-filename')"
						:getExport="getExport"
						size="sm"
					></ExportDropdown>
				</div>
			</template>
		</form>
	</div>
</template>

<style lang="scss">
	.fm-route-form {
		display: flex;
		flex-direction: column;
		min-height: 0;
		flex-grow: 1;

		form {
			display: flex;
			flex-direction: column;
			flex-grow: 1;
		}

		.destination.active .input-group {
			box-shadow: 0 0 3px;
			border-radius: 0.25rem;
		}

		.destination:first-child {
			margin-top: calc(-0.5rem + 2px); // Offset space of first fm-route-form-hover-insert
		}

		&#{&} hr.fm-route-form-hover-insert {
			margin: 0.1rem -0.5rem;
			width: auto;
			border-width: 2px;
			border-color: inherit;
			border-top-style: dashed;

			&:not(.active) {
				border-color: transparent;
			}
		}

		.fm-elevation-plot {
			margin-bottom: 0.5rem;
		}
	}

	.dropdown-menu.fm-route-form-suggestions.show {
		opacity: 0.6;

		> li {
			display: flex;

			> :nth-child(2) {
				flex-grow: 1;
			}
		}

		.dropdown-item {
			width: auto;
			padding: 0.25rem 0.75rem 0.25rem 0.25rem;

			&.fm-route-form-suggestions-zoom {
				padding: 0.25rem 0.25rem 0.25rem 0.75rem;
			}
		}
	}
</style>