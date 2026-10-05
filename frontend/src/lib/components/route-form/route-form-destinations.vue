<script setup lang="ts">
	import { computed, markRaw, nextTick, reactive, readonly, ref, toRaw, toRef, watch, type DeepReadonly } from "vue";
	import Icon from "../ui/icon.vue";
	import { compileFormulaExpression, decodeRouteQuery, encodeRouteQuery, formatCoordinates, formatDistance, formatRouteMode, formatRouteTime, formatTypeName, isSearchId, markdownInline, normalizeMarkerName, type StrippedTypeForFormula } from "facilmap-utils";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import type { FindOnMapResult, SearchResult } from "facilmap-types";
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
	import { mapRef } from "../../utils/vue";
	import { useMapHandler, useMapLayer } from "../../utils/leaflet";
	import LinesLayerTooltip from "facilmap-leaflet/src/lines/lines-layer-tooltip.js";
	import { useRouteFormDrag } from "./route-form-drag.js";
	import RouteFormDestinations from "./route-form-destinations.vue";
	import { dragMarkerColour, getRouteDragIcon, getSelectedSuggestion, type RouteFormDestination, type RouteFormMapSuggestion, type RouteFormSuggestion } from "./route-form-utils.js";
	import type { RouteWithTrackPoints } from "facilmap-client";

	const i18n = useI18n();
	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);
	const toasts = useToasts();

	const props = defineProps<{
		routeId: string | undefined;
		routeLayer: Raw<RouteLayer>;
		active: boolean;
		hasRouteError?: boolean;
	}>();

	const emit = defineEmits<{
		reroute: [zoom: boolean];
	}>();

	const destinations = defineModel<RouteFormDestination[]>("destinations", { required: true });

	const hoverDestinationIdx = ref<number>();

	const inputRefs = reactive(new Map<number, HTMLInputElement>());

	const suggestionMarker = ref<MarkerLayer>();

	function getValidationState(destination: RouteFormDestination): boolean | null {
		if (props.hasRouteError && destination.query.trim() == '')
			return false;
		else if (destination.loadedQuery && destination.query == destination.loadedQuery && getSelectedSuggestion(destination) == null)
			return false;
		else
			return null;
	}

	const destinationsMeta = computed(() => destinations.value.map((destination) => ({
		isInvalid: getValidationState(destination) === false
	})));

	const routeObj = computed(() => props.routeId ? client.value.routes[props.routeId] : client.value.route);
	const hasRoute = computed(() => !!routeObj.value);

	const drag = useRouteFormDrag(readonly(reactive({
		destinations: destinations,
		route: routeObj,
		routeLayer: toRef(() => props.routeLayer),
		hoverDestinationIdx,
		destinationMouseOver,
		destinationMouseOut,
		reroute: (zoom) => { emit("reroute", zoom); }
	})));

	watch([hasRoute, () => props.active, drag, () => props.routeLayer], () => {
		if (hasRoute.value)
			props.routeLayer.setStyle({ opacity: props.active ? 1 : 0.35, raised: props.active });

		// Enable dragging after updating the style, since that might re-add the layer to the map
		if (props.active) {
			drag.enable();
		} else {
			drag.disable();
		}
	}, { immediate: true });

	function addDestination(): void {
		destinations.value.push({
			query: ""
		});
	}

	function removeDestination(idx: number): void {
		if (destinations.value.length > 2)
			destinations.value.splice(idx, 1);
	}

	async function loadSuggestions(dest: RouteFormDestination): Promise<void> {
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
								return (await client.value.findOnMap({ query })).filter((res) => res.kind == "marker") as RouteFormMapSuggestion[];
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

	function suggestionMouseOver(suggestion: RouteFormSuggestion): void {
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

	function suggestionZoom(suggestion: RouteFormSuggestion): void {
		mapContext.value.components.map.flyTo([suggestion.lat!, suggestion.lon!]);
	}

	function destinationMouseOver(idx: number): void {
		const marker = props.routeLayer._draggableLines?.dragMarkers[idx];

		if (marker) {
			hoverDestinationIdx.value = idx;
			marker.setIcon(getRouteDragIcon(idx, props.routeLayer._draggableLines!.dragMarkers.length, true));
		}
	}

	function destinationMouseOut(idx: number): void {
		hoverDestinationIdx.value = undefined;

		const marker = props.routeLayer._draggableLines?.dragMarkers[idx];
		if (marker) {
			void Promise.resolve().then(() => {
				// If mouseout event is directly followed by a dragend event, the marker will be removed. Only update the icon if the marker is not removed.
				if (marker["_map"])
					marker.setIcon(getRouteDragIcon(idx, props.routeLayer._draggableLines!.dragMarkers.length));
			});
		}
	}

	async function loadAllSuggestions(): Promise<void> {
		await Promise.all(destinations.value.map((dest) => loadSuggestions(dest)));
	}

	function focusDestination(idx: number): void {
		inputRefs.get(idx)?.focus();
	}

	function reset(): void {
		if(suggestionMarker.value) {
			suggestionMarker.value.remove();
			suggestionMarker.value = undefined;
		}
	}

	defineExpose({
		loadAllSuggestions,
		addDestination,
		focusDestination,
		reset
	});
</script>

<template>
	<Draggable
		v-model="destinations"
		handle=".fm-drag-handle"
		@end="emit('reroute', true)"
		:itemKey="(destination: any) => destinations.indexOf(destination)"
	>
		<template #item="{ element: destination, index: idx }">
			<div class="destination" :class="{ active: hoverDestinationIdx == idx }">
				<hr class="fm-route-form-hover-insert" :class="{ active: drag.hoverInsertIdx === idx }"/>
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
										@click="destination.selectedSuggestion = suggestion; emit('reroute', true)"
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
										@click="destination.selectedSuggestion = suggestion; emit('reroute', true)"
									>{{suggestion.display_name}}<span v-if="suggestion.type"> ({{suggestion.type}})</span></a>
								</li>
							</template>
						</DropdownMenu>
					</template>
					<button
						v-if="destinations.length > 2"
						type="button"
						class="btn btn-secondary"
						@click="removeDestination(idx); emit('reroute', false)"
						v-tooltip.right="i18n.t('route-form.remove-destination-tooltip')"
					>
						<Icon icon="minus" :alt="i18n.t('route-form.remove-destination-alt')" size="1.0em"></Icon>
					</button>
				</div>
			</div>
		</template>
		<template #footer>
			<hr class="fm-route-form-hover-insert" :class="{ active: drag.hoverInsertIdx === destinations.length }"/>
		</template>
	</Draggable>
</template>