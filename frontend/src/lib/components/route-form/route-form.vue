<script setup lang="ts">
	import { computed, markRaw, onBeforeUnmount, onMounted, ref, watch, watchEffect } from "vue";
	import Icon from "../ui/icon.vue";
	import { formatRouteMode, formatTime, isSearchId, round, splitRouteQuery } from "facilmap-utils";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import type { ExportFormat, FindOnMapResult, SearchResult, Type } from "facilmap-types";
	import { getMarkerIcon, HashQuery, MarkerLayer, RouteLayer } from "facilmap-leaflet";
	import { getZoomDestinationForRoute, flyTo, normalizeZoomDestination } from "../../utils/zoom";
	import { latLng, LatLng } from "leaflet";
	import Draggable from "vuedraggable";
	import RouteMode from "../ui/route-mode.vue";
	import DraggableLines from "leaflet-draggable-lines";
	import { throttle } from "lodash-es";
	import ElevationStats from "../ui/elevation-stats.vue";
	import ElevationPlot from "../ui/elevation-plot.vue";
	import { saveAs } from 'file-saver';
	import { isMapResult } from "../../utils/search";
	import vTooltip from "../../utils/tooltip";
	import { injectContextRequired } from "../../utils/context";
	import { injectClientRequired } from "../client-context.vue";
	import { injectMapContextRequired } from "../leaflet-map/leaflet-map.vue";

	type SearchSuggestion = SearchResult;
	type MapSuggestion = FindOnMapResult & { kind: "marker" };
	type Suggestion = SearchSuggestion | MapSuggestion;

	interface Destination {
		query: string;
		loadingQuery?: string;
		loadingPromise?: Promise<void>;
		loadedQuery?: string;
		searchSuggestions?: SearchSuggestion[];
		mapSuggestions?: MapSuggestion[];
		selectedSuggestion?: Suggestion;
	}

	function makeCoordDestination(latlng: LatLng) {
		const disp = round(latlng.lat, 5) + "," + round(latlng.lng, 5);
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
	const client = injectClientRequired();
	const mapContext = injectMapContextRequired();

	const toasts = useToasts();

	const submitButton = ref<HTMLButtonElement>();

	const props = withDefaults(defineProps<{
		active?: boolean;
		routeId?: string;
		showToolbar?: boolean;
	}>(), {
		active: true,
		showToolbar: true
	});

	const emit = defineEmits<{
		activate: [];
		"hash-query-change": [hashQuery: HashQuery | undefined];
	}>();

	const routeObj = computed(() => props.routeId ? client.routes[props.routeId] : client.route);
	const hasRoute = computed(() => !!routeObj.value);

	const routeMode = ref(routeObj.value?.mode ?? "car");
	const destinations = ref<Destination[]>(routeObj.value ? (
		routeObj.value.routePoints.map((point) => makeCoordDestination(latLng(point.lat, point.lon)))
	) : (
		[{ query: "" }, { query: "" }]
	));
	const submittedQuery = ref<string>();
	const submittedQueryDescription = ref<string>();
	const routeError = ref<string>();
	const hoverDestinationIdx = ref<number>();
	const hoverInsertIdx = ref<number>();
	const isAdding = ref(false);
	const isExporting = ref(false);
	const suggestionMarker = ref<MarkerLayer>();

	const routeLayer = new RouteLayer(client, props.routeId, { weight: 7, opacity: 1, raised: true });
	routeLayer.on("click", (e) => {
		if (!props.active && !(e.originalEvent as any).ctrlKey) {
			emit("activate");
		}
	});

	const draggable = new DraggableLines(mapContext.components.map, {
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
	});
	draggable.on({
		insert: (e: any) => {
			destinations.value.splice(e.idx, 0, makeCoordDestination(e.latlng));
			reroute(false);
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
			reroute(false);
		},
		remove: (e: any) => {
			hoverDestinationIdx.value = undefined;
			destinations.value.splice(e.idx, 1);
			reroute(false);
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

	onMounted(() => {
		routeLayer.addTo(mapContext.components.map);
		draggable.enable();
	});

	onBeforeUnmount(() => {
		draggable.disable();
		routeLayer.remove();
	});

	const lineTypes = computed(() => Object.values(client.types).filter((type) => type.type == "line"));

	const hashQuery = computed(() => {
		if (submittedQuery.value) {
			const zoomDest = routeObj.value && getZoomDestinationForRoute(routeObj.value);
			return {
				query: submittedQuery.value,
				...(zoomDest ? normalizeZoomDestination(mapContext.components.map, zoomDest) : {}),
				description: `Route from ${submittedQueryDescription.value}`
			};
		} else
			return undefined;
	});

	watchEffect(() => {
		if (hasRoute.value)
			routeLayer.setStyle({ opacity: props.active ? 1 : 0.35, raised: props.active });

		// Enable dragging after updating the style, since that might re-add the layer to the map
		if (props.active)
			draggable.enableForLayer(routeLayer);
		else
			draggable.disableForLayer(routeLayer);
	});

	watch(hashQuery, (hashQuery) => {
		emit("hash-query-change", hashQuery);
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
					client.find({ query: query }),
					(async () => {
						if (client.padData) {
							const m = query.match(/^m(\d+)$/);
							if (m) {
								const marker = await client.getMarker({ id: Number(m[1]) });
								return marker ? [{ kind: "marker" as const, similarity: 1, ...marker }] : [];
							} else
								return (await client.findOnMap({ query })).filter((res) => res.kind == "marker") as MapSuggestion[];
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
							dest.query = referencedMapResult.name;
						dest.loadedQuery = referencedMapResult.name;
						dest.selectedSuggestion = referencedMapResult;
					}
				}

				if(dest.selectedSuggestion == null)
					dest.selectedSuggestion = getSelectedSuggestion(dest);
			} catch (err: any) {
				if(query != dest.loadingQuery)
					return; // The destination has changed in the meantime

				console.warn(err.stack || err);
				toasts.showErrorToast(`fm${context.id}-route-form-suggestion-error-${idx}`, `Error finding destination “${query}”`, err);
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
				symbol: "",
				shape: "drop"
			}
		})).addTo(mapContext.components.map));
	}

	function suggestionMouseOut(): void {
		if(suggestionMarker.value) {
			suggestionMarker.value.remove();
			suggestionMarker.value = undefined;
		}
	}

	function suggestionZoom(suggestion: Suggestion): void {
		mapContext.components.map.flyTo([suggestion.lat!, suggestion.lon!]);
	}

	function destinationMouseOver(idx: number): void {
		const marker = routeLayer._draggableLines?.dragMarkers[idx];

		if (marker) {
			hoverDestinationIdx.value = idx;
			marker.setIcon(getIcon(idx, routeLayer._draggableLines!.dragMarkers.length, true));
		}
	}

	function destinationMouseOut(idx: number): void {
		hoverDestinationIdx.value = undefined;

		const marker = routeLayer._draggableLines?.dragMarkers[idx];
		if (marker) {
			Promise.resolve().then(() => {
				// If mouseout event is directly followed by a dragend event, the marker will be removed. Only update the icon if the marker is not removed.
				if (marker["_map"])
					marker.setIcon(getIcon(idx, routeLayer._draggableLines!.dragMarkers.length));
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

			submittedQuery.value = [
				destinations.value.map((dest) => (getSelectedSuggestionId(dest) ?? dest.query)).join(" to "),
				mode
			].join(" by ");
			submittedQueryDescription.value = [
				destinations.value.map((dest) => (getSelectedSuggestionName(dest) ?? dest.query)).join(" to "),
				mode
			].join(" by ");

			await Promise.all(destinations.value.map((dest) => loadSuggestions(dest)));
			const points = destinations.value.map((dest) => getSelectedSuggestion(dest));

			submittedQuery.value = [
				destinations.value.map((dest) => (getSelectedSuggestionId(dest) ?? dest.query)).join(" to "),
				mode
			].join(" by ");
			submittedQueryDescription.value = [
				destinations.value.map((dest) => (getSelectedSuggestionName(dest) ?? dest.query)).join(" to "),
				mode
			].join(" by ");

			if(points.some((point) => point == null)) {
				routeError.value = "Some destinations could not be found.";
				return;
			}

			const route = await client.setRoute({
				routePoints: points.map((point) => ({ lat: point!.lat!, lon: point!.lon! })),
				mode,
				routeId: props.routeId
			});

			if (route && zoom)
				flyTo(mapContext.components.map, getZoomDestinationForRoute(route), smooth);
		} catch (err: any) {
			toasts.showErrorToast(`fm${context.id}-route-form-error`, "Error calculating route", err);
		}
	}

	async function reroute(zoom: boolean, smooth = true): Promise<void> {
		if(hasRoute.value) {
			await Promise.all(destinations.value.map((dest) => loadSuggestions(dest)));
			const points = destinations.value.map((dest) => getSelectedSuggestion(dest));

			if(!points.some((point) => point == null))
				route(zoom, smooth);
		}
	}

	function reset(): void {
		toasts.hideToast(`fm${context.id}-route-form-error`);
		submittedQuery.value = undefined;
		submittedQueryDescription.value = undefined;
		routeError.value = undefined;

		if(suggestionMarker.value) {
			suggestionMarker.value.remove();
			suggestionMarker.value = undefined;
		}

		client.clearRoute({ routeId: props.routeId });
	}

	function clear(): void {
		reset();

		destinations.value = [
			{ query: "" },
			{ query: "" }
		];
	}

	function zoomToRoute(): void {
		if (routeObj.value)
			flyTo(mapContext.components.map, getZoomDestinationForRoute(routeObj.value));
	}

	function handleSubmit(event: Event): void {
		submitButton.value?.focus();
		route(true);
	}

	async function addToMap(type: Type): Promise<void> {
		toasts.hideToast(`fm${context.id}-route-form-add-error`);
		isAdding.value = true;

		try {
			const line = await client.addLine({ typeId: type.id, routePoints: routeObj.value!.routePoints, mode: routeObj.value!.mode });
			clear();
			mapContext.components.selectionHandler.setSelectedItems([{ type: "line", id: line.id }], true);
		} catch (err: any) {
			toasts.showErrorToast(`fm${context.id}-route-form-add-error`, "Error adding line", err);
		} finally {
			isAdding.value = false;
		}
	}

	async function exportRoute(format: ExportFormat): Promise<void> {
		toasts.hideToast(`fm${context.id}-route-form-export-error`);
		isExporting.value = true;

		try {
			const exported = await client.exportRoute({ format });
			saveAs(new Blob([exported], { type: "application/gpx+xml" }), "FacilMap route.gpx");
		} catch(err: any) {
			toasts.showErrorToast(`fm${context.id}-route-form-export-error`, "Error exporting route", err);
		} finally {
			isExporting.value = false;
		}
	}

	function setQuery({ query, zoom = true, smooth = true }: { query: string; zoom?: boolean; smooth?: boolean }): void {
		clear();
		const split = splitRouteQuery(query);
		destinations.value = split.queries.map((query) => ({ query }));
		while (destinations.value.length < 2)
			destinations.value.push({ query: "" });
		routeMode.value = split.mode ?? "car";
		route(zoom, smooth);
	}

	function setFrom(data: Parameters<typeof makeDestination>[0]): void {
		destinations.value[0] = makeDestination(data);
		reroute(true);
	}

	function addVia(data: Parameters<typeof makeDestination>[0]): void {
		destinations.value.splice(destinations.value.length - 1, 0, makeDestination(data));
		reroute(true);
	}

	function setTo(data: Parameters<typeof makeDestination>[0]): void {
		destinations.value[destinations.value.length - 1] = makeDestination(data);
		reroute(true);
	}

	defineExpose({ setQuery, setFrom, addVia, setTo });
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
							:state="getValidationState(destination)"
						>
							<span class="input-group-text px-2">
								<a href="javascript:" class="fm-drag-handle" @contextmenu.prevent>
									<Icon icon="resize-vertical" alt="Reorder"></Icon>
								</a>
							</span>
							<input class="form-control" v-model="destination.query" :placeholder="idx == 0 ? 'From' : idx == destinations.length-1 ? 'To' : 'Via'" :tabindex="idx+1" :state="getValidationState(destination)" @blur="loadSuggestions(destination)" />
							<template v-if="destination.query.trim() != ''">
								<button type="button" class="btn btn-secondary dropdown-toggle" data-bs-toggle="dropdown"></button>
								<ul
									class="dropdown-menu fm-route-suggestions"
									:class="{ isPending: !destination.searchSuggestions, isNarrow: context.isNarrow }"
									v-on="{ 'show.bs.dropdown': () => { loadSuggestions(destination); } }"
								>
									<template v-if="destination.searchSuggestions">
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
												><Icon icon="zoom-in" alt="Zoom"></Icon></a>

												<a
													href="javascript:"
													class="dropdown-item"
													:class="{ active: suggestion === getSelectedSuggestion(destination) }"
													@click="destination.selectedSuggestion = suggestion; reroute(true)"
												>{{suggestion.name}} ({{client.types[suggestion.typeId].name}})</a>
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
												><Icon icon="zoom-in" alt="Zoom"></Icon></a>
												<a
													href="javascript:"
													class="dropdown-item"
													:class="{ active: suggestion === getSelectedSuggestion(destination) }"
													@click="destination.selectedSuggestion = suggestion; reroute(true)"
												>{{suggestion.display_name}}<span v-if="suggestion.type"> ({{suggestion.type}})</span></a>
											</li>
										</template>
									</template>
									<div v-else class="spinner-border"></div>
								</ul>
							</template>
							<button
								v-if="destinations.length > 2"
								type="button"
								class="btn btn-secondary"
								@click="removeDestination(idx); reroute(false)"
								v-tooltip.right="'Remove this destination'"
							>
								<Icon icon="minus" alt="Remove" size="1.0em"></Icon>
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
					v-tooltip.bottom="'Add another destination'"
					:tabindex="destinations.length+1"
				>
					<Icon icon="plus" alt="Add"></Icon>
				</button>

				<RouteMode v-model="routeMode" :tabindex="destinations.length+2" @update:modelValue="reroute(false)" tooltip-placement="bottom"></RouteMode>

				<button
					type="submit"
					class="btn btn-primary flex-grow-1"
					:tabindex="destinations.length+7"
					ref="submitButton"
				>Go!</button>
				<button
					v-if="hasRoute"
					type="button"
					class="btn btn-secondary"
					:tabindex="destinations.length+8"
					@click="reset()"
					v-tooltip.right="'Clear route'"
				>
					<Icon icon="remove" alt="Clear"></Icon>
				</button>
			</div>

			<template v-if="routeError">
				<hr />

				<div class="alert alert-danger">{{routeError}}</div>
			</template>

			<template v-if="routeObj">
				<hr />

				<dl>
					<dt>Distance</dt>
					<dd>{{round(routeObj.distance, 2)}} km <span v-if="routeObj.time != null">({{formatTime(routeObj.time)}} h {{formatRouteMode(routeObj.mode)}})</span></dd>

					<template v-if="routeObj.ascent != null">
						<dt>Climb/drop</dt>
						<dd><ElevationStats :route="routeObj"></ElevationStats></dd>
					</template>
				</dl>

				<ElevationPlot :route="routeObj" v-if="routeObj.ascent != null"></ElevationPlot>

				<div v-if="showToolbar && !client.readonly" class="btn-group" role="group">
					<button
						type="button"
						class="btn btn-secondary btn-sm"
						v-tooltip="'Zoom to route'"
						@click="zoomToRoute()"
					>
						<Icon icon="zoom-in" alt="Zoom to route"></Icon>
					</button>

					<div v-if="lineTypes.length > 0" class="dropdown">
						<button type="button" class="btn btn-secondary btn-sm dropdown-toggle" :disabled="isAdding" data-bs-toggle="dropdown">
							<div v-if="isAdding" class="spinner-border spinner-border-sm"></div>
							Add to map
						</button>

						<ul class="dropdown-menu">
							<template v-for="type in lineTypes" :key="type.id">
								<li>
									<a
										href="javascript:"
										class="dropdown-item"
										@click="addToMap(type)"
									>{{type.name}}</a>
								</li>
							</template>
						</ul>
					</div>
					<div class="dropdown">
						<button type="button" class="btn btn-secondary btn-sm dropdown-toggle" :disabled="isExporting">
							<div v-if="isExporting" class="spinner-border spinner-border-sm"></div>
							Export
						</button>

						<ul class="dropdown-menu">
							<li>
								<a
									href="javascript:"
									class="dropdown-item"
									@click="exportRoute('gpx-trk')"
									v-tooltip.right="'GPX files can be opened with most navigation software. In track mode, the calculated route is saved in the file.'"
								>Export as GPX track</a>
							</li>
							<li>
								<a
									href="javascript:"
									class="dropdown-item"
									@click="exportRoute('gpx-rte')"
									v-tooltip.right="'GPX files can be opened with most navigation software. In route mode, only the start/end/via points are saved in the file, and the navigation software needs to calculate the route.'"
								>Export as GPX route</a>
							</li>
						</ul>
					</div>
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

		hr.fm-route-form-hover-insert {
			margin: 0.1rem -0.5rem;
			width: auto;
			border-width: 2px;
			border-color: inherit;
			border-top-style: dashed;

			&:not(.active) {
				border-color: transparent;
			}
		}
	}

	.fm-route-suggestions.show {
		opacity: 0.6;

		&.isPending {
			display: flex !important;
			align-items: center;
			justify-content: center;
		}

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