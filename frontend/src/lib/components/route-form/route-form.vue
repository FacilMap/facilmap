<script setup lang="ts">
	import WithRender from "./route-form.vue";
	import "./route-form.scss";
	import Vue from "vue";
	import { Component, Prop, Ref, Watch } from "vue-property-decorator";
	import Icon from "../ui/icon/icon";
	import { InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
	import { isSearchId, round, splitRouteQuery } from "facilmap-utils";
	import Client, { RouteWithTrackPoints } from "facilmap-client";
	import { showErrorToast } from "../../utils/toasts";
	import { ExportFormat, FindOnMapResult, SearchResult, Type } from "facilmap-types";
	import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
	import { getMarkerIcon, HashQuery, MarkerLayer, RouteLayer } from "facilmap-leaflet";
	import { getZoomDestinationForRoute, flyTo, normalizeZoomDestination } from "../../utils/zoom";
	import { latLng, LatLng } from "leaflet";
	import draggable from "vuedraggable";
	import RouteMode from "../ui/route-mode/route-mode";
	import DraggableLines from "leaflet-draggable-lines";
	import { throttle } from "lodash-es";
	import ElevationStats from "../ui/elevation-stats/elevation-stats";
	import ElevationPlot from "../ui/elevation-plot/elevation-plot";
	import { saveAs } from 'file-saver';
	import { isMapResult } from "../../utils/search";
	import { Context } from "../facilmap/facilmap";

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

	function makeDestination(query: string, searchSuggestions?: SearchResult[], mapSuggestions?: FindOnMapResult[], selectedSuggestion?: SearchResult | FindOnMapResult): Destination {
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

	@WithRender
	@Component({
		components: { draggable, ElevationPlot, ElevationStats, Icon, RouteMode }
	})
	export default class RouteForm extends Vue {

		const context = injectContextRequired();
		const mapComponents = injectMapComponentsRequired();
		const client = injectClientRequired();
		const mapContext = injectMapContextRequired();

		@Ref() submitButton!: HTMLButtonElement;

		@Prop({ type: Boolean, default: true }) active!: boolean;
		@Prop({ type: String }) routeId: string | undefined;
		@Prop({ type: Boolean, default: true }) showToolbar!: boolean;

		routeLayer!: RouteLayer;
		draggable!: DraggableLines;

		routeMode = 'car';
		destinations: Destination[] = [
			{ query: "" },
			{ query: "" }
		];
		submittedQuery: string | null = null;
		submittedQueryDescription: string | null = null;
		routeError: string | null = null;
		hoverDestinationIdx: number | null = null;
		hoverInsertIdx: number | null = null;
		isAdding = false;
		isExporting = false;

		// Do not make reactive
		suggestionMarker: MarkerLayer | undefined;

		mounted(): void {
			this.routeLayer = new RouteLayer(this.client, this.routeId, { weight: 7, opacity: 1, raised: true }).addTo(this.mapComponents.map);
			this.routeLayer.on("click", (e) => {
				if (!this.active && !(e.originalEvent as any).ctrlKey) {
					this.$emit("activate");
				}
			});

			this.draggable = new DraggableLines(this.mapComponents.map, {
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
			}).enable();
			this.draggable.on({
				insert: (e: any) => {
					this.destinations.splice(e.idx, 0, makeCoordDestination(e.latlng));
					this.reroute(false);
				},
				dragstart: (e: any) => {
					this.hoverDestinationIdx = e.idx;
					this.hoverInsertIdx = null;
					if (e.isNew)
						this.destinations.splice(e.idx, 0, makeCoordDestination(e.to));
				},
				drag: throttle((e: any) => {
					Vue.set(this.destinations, e.idx, makeCoordDestination(e.to));
				}, 300),
				dragend: (e: any) => {
					Vue.set(this.destinations, e.idx, makeCoordDestination(e.to));
					this.reroute(false);
				},
				remove: (e: any) => {
					this.hoverDestinationIdx = null;
					this.destinations.splice(e.idx, 1);
					this.reroute(false);
				},
				dragmouseover: (e: any) => {
					this.destinationMouseOver(e.idx);
				},
				dragmouseout: (e: any) => {
					this.destinationMouseOut(e.idx);
				},
				plusmouseover: (e: any) => {
					this.hoverInsertIdx = e.idx;
				},
				plusmouseout: (e: any) => {
					this.hoverInsertIdx = null;
				},
				tempmouseover: (e: any) => {
					this.hoverInsertIdx = e.idx;
				},
				tempmousemove: (e: any) => {
					if (e.idx != this.hoverInsertIdx)
						this.hoverInsertIdx = e.idx;
				},
				tempmouseout: (e: any) => {
					this.hoverInsertIdx = null;
				}
			} as any);

			this.handleActiveChange(this.active);

			if (this.routeObj) {
				this.destinations = this.routeObj.routePoints.map((point) => makeCoordDestination(latLng(point.lat, point.lon)));
				this.routeMode = this.routeObj.mode;
			}
		}

		beforeDestroy(): void {
			this.draggable.disable();
			this.routeLayer.remove();
		}

		get routeObj(): RouteWithTrackPoints | undefined {
			return this.routeId ? this.client.routes[this.routeId] : this.client.route;
		}

		@Watch("active")
		handleActiveChange(active: boolean): void {
			if (this.hasRoute)
				this.routeLayer.setStyle({ opacity: active ? 1 : 0.35, raised: active });

			// Enable dragging after updating the style, since that might re-add the layer to the map
			if (active)
				this.draggable.enableForLayer(this.routeLayer);
			else
				this.draggable.disableForLayer(this.routeLayer);
		}

		get hasRoute(): boolean {
			return !!this.routeObj;
		}

		get lineTypes(): Type[] {
			return Object.values(this.client.types).filter((type) => type.type == "line");
		}

		get hashQuery(): HashQuery | undefined {
			if (this.submittedQuery) {
				const zoomDest = this.routeObj && getZoomDestinationForRoute(this.routeObj);
				return {
					query: this.submittedQuery,
					...(zoomDest ? normalizeZoomDestination(this.mapComponents.map, zoomDest) : {}),
					description: `Route from ${this.submittedQueryDescription}`
				};
			} else
				return undefined;
		}

		@Watch("hashQuery")
		handleHashQueryChange(hashQuery: HashQuery | undefined): void {
			this.$emit("hash-query-change", hashQuery);
		}

		addDestination(): void {
			this.destinations.push({
				query: ""
			});
		}

		removeDestination(idx: number): void {
			if (this.destinations.length > 2)
				this.destinations.splice(idx, 1);
		}

		getSelectedSuggestion(dest: Destination): Suggestion | undefined {
			if(dest.selectedSuggestion && [...(dest.searchSuggestions || []), ...(dest.mapSuggestions || [])].includes(dest.selectedSuggestion))
				return dest.selectedSuggestion;
			else if(dest.mapSuggestions && dest.mapSuggestions.length > 0 && (dest.mapSuggestions[0].similarity == 1 || (dest.searchSuggestions || []).length == 0))
				return dest.mapSuggestions[0];
			else if((dest.searchSuggestions || []).length > 0)
				return dest.searchSuggestions![0];
			else
				return undefined;
		}

		getSelectedSuggestionId(dest: Destination): string | undefined {
			const sugg = this.getSelectedSuggestion(dest);
			if (!sugg)
				return undefined;

			if (isMapResult(sugg))
				return (sugg.kind == "marker" ? "m" : "l") + sugg.id;
			else
				return sugg.id;
		}

		getSelectedSuggestionName(dest: Destination): string | undefined {
			const sugg = this.getSelectedSuggestion(dest);
			if (!sugg)
				return undefined;

			if (isMapResult(sugg))
				return sugg.name;
			else
				return sugg.short_name;
		}

		async loadSuggestions(dest: Destination): Promise<void> {
			if (dest.loadingQuery == dest.query.trim()) {
				await dest.loadingPromise;
				return;
			} else if (dest.loadedQuery == dest.query.trim())
				return;

			const idx = this.destinations.indexOf(dest);
			this.$bvToast.hide(`fm${this.context.id}-route-form-suggestion-error-${idx}`);
			Vue.set(dest, "searchSuggestions", undefined);
			Vue.set(dest, "mapSuggestions", undefined);
			Vue.set(dest, "selectedSuggestion", undefined);
			Vue.set(dest, "loadingQuery", undefined);
			Vue.set(dest, "loadingPromise", undefined);
			Vue.set(dest, "loadedQuery", undefined);

			const query = dest.query.trim();

			if(query != "") {
				dest.loadingQuery = query;
				let resolveLoadingPromise = (): void => undefined;
				dest.loadingPromise = new Promise((resolve) => { resolveLoadingPromise = resolve; });

				try {
					const [searchResults, mapResults] = await Promise.all([
						this.client.find({ query: query }),
						(async () => {
							if (this.client.padData) {
								const m = query.match(/^m(\d+)$/);
								if (m) {
									const marker = await this.client.getMarker({ id: Number(m[1]) });
									return marker ? [{ kind: "marker" as const, similarity: 1, ...marker }] : [];
								} else
									return (await this.client.findOnMap({ query })).filter((res) => res.kind == "marker") as MapSuggestion[];
							}
						})()
					])

					if(query != dest.loadingQuery)
						return; // The destination has changed in the meantime

					Vue.set(dest, "loadingQuery", undefined);
					Vue.set(dest, "loadedQuery", query);
					Vue.set(dest, "searchSuggestions", searchResults);
					Vue.set(dest, "mapSuggestions", mapResults);

					if(isSearchId(query) && searchResults.length > 0 && searchResults[0].display_name) {
						if (dest.query == query)
							Vue.set(dest, "query", searchResults[0].display_name);
						Vue.set(dest, "loadedQuery", searchResults[0].display_name);
						Vue.set(dest, "selectedSuggestion", searchResults[0]);
					}

					if(mapResults) {
						const referencedMapResult = mapResults.find((res) => query == `m${res.id}`);
						if(referencedMapResult) {
							if (dest.query == query)
								Vue.set(dest, "query", referencedMapResult.name);
							Vue.set(dest, "loadedQuery", referencedMapResult.name);
							Vue.set(dest, "selectedSuggestion", referencedMapResult);
						}
					}

					if(dest.selectedSuggestion == null)
						Vue.set(dest, "selectedSuggestion", this.getSelectedSuggestion(dest));
				} catch (err: any) {
					if(query != dest.loadingQuery)
						return; // The destination has changed in the meantime

					console.warn(err.stack || err);
					showErrorToast(this, `fm${this.context.id}-route-form-suggestion-error-${idx}`, `Error finding destination “${query}”`, err);
				} finally {
					resolveLoadingPromise();
				}
			}
		}

		suggestionMouseOver(suggestion: Suggestion): void {
			this.suggestionMarker = (new MarkerLayer([ suggestion.lat!, suggestion.lon! ], {
				highlight: true,
				marker: {
					colour: dragMarkerColour,
					size: 35,
					symbol: "",
					shape: "drop"
				}
			})).addTo(this.mapComponents.map);
		}

		suggestionMouseOut(): void {
			if(this.suggestionMarker) {
				this.suggestionMarker.remove();
				this.suggestionMarker = undefined;
			}
		}

		suggestionZoom(suggestion: Suggestion): void {
			this.mapComponents.map.flyTo([suggestion.lat!, suggestion.lon!]);
		}

		destinationMouseOver(idx: number): void {
			const marker = this.routeLayer._draggableLines?.dragMarkers[idx];

			if (marker) {
				this.hoverDestinationIdx = idx;
				marker.setIcon(getIcon(idx, this.routeLayer._draggableLines!.dragMarkers.length, true));
			}
		}

		destinationMouseOut(idx: number): void {
			this.hoverDestinationIdx = null;

			const marker = this.routeLayer._draggableLines?.dragMarkers[idx];
			if (marker) {
				Promise.resolve().then(() => {
					// If mouseout event is directly followed by a dragend event, the marker will be removed. Only update the icon if the marker is not removed.
					if (marker["_map"])
						marker.setIcon(getIcon(idx, this.routeLayer._draggableLines!.dragMarkers.length));
				});
			}
		}

		getValidationState(destination: Destination): boolean | null {
			if (this.routeError && destination.query.trim() == '')
				return false;
			else if (destination.loadedQuery && destination.query == destination.loadedQuery && this.getSelectedSuggestion(destination) == null)
				return false;
			else
				return null;
		}

		async route(zoom: boolean, smooth = true): Promise<void> {
			this.reset();

			try {
				const mode = this.routeMode;

				this.submittedQuery = [
					this.destinations.map((dest) => (this.getSelectedSuggestionId(dest) ?? dest.query)).join(" to "),
					mode
				].join(" by ");
				this.submittedQueryDescription = [
					this.destinations.map((dest) => (this.getSelectedSuggestionName(dest) ?? dest.query)).join(" to "),
					mode
				].join(" by ");

				await Promise.all(this.destinations.map((dest) => this.loadSuggestions(dest)));
				const points = this.destinations.map((dest) => this.getSelectedSuggestion(dest));

				this.submittedQuery = [
					this.destinations.map((dest) => (this.getSelectedSuggestionId(dest) ?? dest.query)).join(" to "),
					mode
				].join(" by ");
				this.submittedQueryDescription = [
					this.destinations.map((dest) => (this.getSelectedSuggestionName(dest) ?? dest.query)).join(" to "),
					mode
				].join(" by ");

				if(points.some((point) => point == null)) {
					this.routeError = "Some destinations could not be found.";
					return;
				}

				const route = await this.client.setRoute({
					routePoints: points.map((point) => ({ lat: point!.lat!, lon: point!.lon! })),
					mode,
					routeId: this.routeId
				});

				if (route && zoom)
					flyTo(this.mapComponents.map, getZoomDestinationForRoute(route), smooth);
			} catch (err: any) {
				showErrorToast(this, `fm${this.context.id}-route-form-error`, "Error calculating route", err);
			}
		}

		async reroute(zoom: boolean, smooth = true): Promise<void> {
			if(this.hasRoute) {
				await Promise.all(this.destinations.map((dest) => this.loadSuggestions(dest)));
				const points = this.destinations.map((dest) => this.getSelectedSuggestion(dest));

				if(!points.some((point) => point == null))
					this.route(zoom, smooth);
			}
		}

		reset(): void {
			this.$bvToast.hide(`fm${this.context.id}-route-form-error`);
			this.submittedQuery = null;
			this.submittedQueryDescription = null;
			this.routeError = null;

			if(this.suggestionMarker) {
				this.suggestionMarker.remove();
				this.suggestionMarker = undefined;
			}

			this.client.clearRoute({ routeId: this.routeId });
		}

		clear(): void {
			this.reset();

			this.destinations = [
				{ query: "" },
				{ query: "" }
			];
		}

		zoomToRoute(): void {
			if (this.routeObj)
				flyTo(this.mapComponents.map, getZoomDestinationForRoute(this.routeObj));
		}

		handleSubmit(event: Event): void {
			this.submitButton.focus();
			this.route(true);
		}

		async addToMap(type: Type): Promise<void> {
			this.$bvToast.hide(`fm${this.context.id}-route-form-add-error`);
			this.isAdding = true;

			try {
				const line = await this.client.addLine({ typeId: type.id, routePoints: this.routeObj!.routePoints, mode: this.routeObj!.mode });
				this.clear();
				this.mapComponents.selectionHandler.setSelectedItems([{ type: "line", id: line.id }], true);
			} catch (err: any) {
				showErrorToast(this, `fm${this.context.id}-route-form-add-error`, "Error adding line", err);
			} finally {
				this.isAdding = false;
			}
		}

		async exportRoute(format: ExportFormat): Promise<void> {
			this.$bvToast.hide(`fm${this.context.id}-route-form-export-error`);
			this.isExporting = true;

			try {
				const exported = await this.client.exportRoute({ format });
				saveAs(new Blob([exported], { type: "application/gpx+xml" }), "FacilMap route.gpx");
			} catch(err: any) {
				showErrorToast(this, `fm${this.context.id}-route-form-export-error`, "Error exporting route", err);
			} finally {
				this.isExporting = false;
			}
		}

		setQuery(query: string, zoom = true, smooth = true): void {
			this.clear();
			const split = splitRouteQuery(query);
			this.destinations = split.queries.map((query) => ({ query }));
			while (this.destinations.length < 2)
				this.destinations.push({ query: "" });
			this.routeMode = split.mode ?? "car";
			this.route(zoom, smooth);
		}

		setFrom(...args: Parameters<typeof makeDestination>): void {
			Vue.set(this.destinations, 0, makeDestination(...args));
			this.reroute(true);
		}

		addVia(...args: Parameters<typeof makeDestination>): void {
			this.destinations.splice(this.destinations.length - 1, 0, makeDestination(...args));
			this.reroute(true);
		}

		setTo(...args: Parameters<typeof makeDestination>): void {
			Vue.set(this.destinations, this.destinations.length - 1, makeDestination(...args));
			this.reroute(true);
		}

	}

</script>

<template>
	<div class="fm-route-form">
		<b-form @submit.prevent="handleSubmit">
			<draggable v-model="destinations" handle=".fm-drag-handle" @end="reroute(true)">
				<b-form-group v-for="(destination, idx) in destinations" :class="{ active: hoverDestinationIdx == idx }">
					<hr class="fm-route-form-hover-insert" :class="{ active: hoverInsertIdx === idx }"/>
					<b-input-group @mouseenter="destinationMouseOver(idx)" @mouseleave="destinationMouseOut(idx)" :state="getValidationState(destination)">
						<b-input-group-prepend>
							<b-input-group-text class="px-2"><a href="javascript:" class="fm-drag-handle" @contextmenu.prevent><Icon icon="resize-vertical" alt="Reorder"></Icon></a></b-input-group-text>
						</b-input-group-prepend>
						<b-form-input v-model="destination.query" :placeholder="idx == 0 ? 'From' : idx == destinations.length-1 ? 'To' : 'Via'" :tabindex="idx+1" :state="getValidationState(destination)" @blur="loadSuggestions(destination)"></b-form-input>
						<b-input-group-append>
							<b-dropdown v-if="destination.query.trim() != ''" @show="loadSuggestions(destination)" :menu-class="['fm-route-suggestions', { isPending: !destination.searchSuggestions, isNarrow: context.isNarrow }]">
								<template v-if="destination.searchSuggestions">
									<template v-for="suggestion in destination.mapSuggestions">
										<b-dropdown-item
											:active="suggestion === getSelectedSuggestion(destination)"
											@mouseenter.native="suggestionMouseOver(suggestion)"
											@mouseleave.native="suggestionMouseOut(suggestion)"
											@click.native.capture.stop.prevent="suggestionZoom(suggestion)"
											class="fm-route-form-suggestions-zoom"
										><Icon icon="zoom-in" alt="Zoom"></Icon></b-dropdown-item>
										<b-dropdown-item
										:active="suggestion === getSelectedSuggestion(destination)"
											@mouseenter.native="suggestionMouseOver(suggestion)"
											@mouseleave.native="suggestionMouseOut(suggestion)"
											@click="destination.selectedSuggestion = suggestion; reroute(true)"
										>{{suggestion.name}} ({{client.types[suggestion.typeId].name}})</b-dropdown-item>
									</template>
									<b-dropdown-divider
										v-if="(destination.searchSuggestions || []).length > 0 && (destination.mapSuggestions || []).length > 0"
										class="fm-route-form-suggestions-divider"
									></b-dropdown-divider>
									<template v-for="suggestion in destination.searchSuggestions">
										<b-dropdown-item
											href="javascript:"
											:active="suggestion === getSelectedSuggestion(destination)"
											@mouseenter.native="suggestionMouseOver(suggestion)"
											@mouseleave.native="suggestionMouseOut(suggestion)"
											@click.native.capture.stop.prevent="suggestionZoom(suggestion)"
											class="fm-route-form-suggestions-zoom"
										><Icon icon="zoom-in" alt="Zoom"></Icon></b-dropdown-item>
										<b-dropdown-item
											href="javascript:"
											:active="suggestion === getSelectedSuggestion(destination)"
											@mouseenter.native="suggestionMouseOver(suggestion)"
											@mouseleave.native="suggestionMouseOut(suggestion)"
											@click="destination.selectedSuggestion = suggestion; reroute(true)"
										>{{suggestion.display_name}}<span v-if="suggestion.type"> ({{suggestion.type}})</span></b-dropdown-item>
									</template>
								</template>
								<div v-else class="spinner-border"></div>
							</b-dropdown>
							<b-button v-if="destinations.length > 2" @click="removeDestination(idx); reroute(false)" v-b-tooltip.hover.right="'Remove this destination'"><Icon icon="minus" alt="Remove" size="1.0em"></Icon></b-button>
						</b-input-group-append>
					</b-input-group>
				</b-form-group>
				<hr class="fm-route-form-hover-insert" :class="{ active: hoverInsertIdx === destinations.length }"/>
			</draggable>

			<b-button-toolbar>
				<b-button @click="addDestination()" v-b-tooltip.hover.bottom="'Add another destination'" :tabindex="destinations.length+1"><Icon icon="plus" alt="Add"></Icon></b-button>

				<RouteMode v-model="routeMode" :tabindex="destinations.length+2" @input="reroute(false)" tooltip-placement="bottom"></RouteMode>

				<b-button type="submit" variant="primary" :tabindex="destinations.length+7" class="flex-grow-1" ref="submitButton">Go!</b-button>
				<b-button v-if="hasRoute" type="button" :tabindex="destinations.length+8" @click="reset()" v-b-tooltip.hover.right="'Clear route'"><Icon icon="remove" alt="Clear"></Icon></b-button>
			</b-button-toolbar>

			<template v-if="routeError">
				<hr />

				<div class="alert alert-danger">{{routeError}}</div>
			</template>

			<template v-if="routeObj">
				<hr />

				<dl>
					<dt>Distance</dt>
					<dd>{{routeObj.distance | round(2)}} km <span v-if="routeObj.time != null">({{routeObj.time | fmFormatTime}} h {{routeObj.mode | fmRouteMode}})</span></dd>

					<template v-if="routeObj.ascent != null">
						<dt>Climb/drop</dt>
						<dd><ElevationStats :route="routeObj"></ElevationStats></dd>
					</template>
				</dl>

				<ElevationPlot :route="routeObj" v-if="routeObj.ascent != null"></ElevationPlot>

				<b-button-toolbar v-if="showToolbar && !client.readonly">
					<b-button v-b-tooltip.hover="'Zoom to route'" @click="zoomToRoute()" size="sm"><Icon icon="zoom-in" alt="Zoom to route"></Icon></b-button>

					<b-dropdown v-if="lineTypes.length > 0" size="sm" :disabled="isAdding">
						<template #button-content>
							<div v-if="isAdding" class="spinner-border spinner-border-sm"></div>
							Add to map
						</template>

						<b-dropdown-item v-for="type in lineTypes" href="javascript:" @click="addToMap(type)">{{type.name}}</b-dropdown-item>
					</b-dropdown>
					<b-dropdown size="sm" :disabled="isExporting">
						<template #button-content>
							<div v-if="isExporting" class="spinner-border spinner-border-sm"></div>
							Export
						</template>

						<b-dropdown-item
							href="javascript:"
							@click="exportRoute('gpx-trk')"
							v-b-tooltip.hover.right="'GPX files can be opened with most navigation software. In track mode, the calculated route is saved in the file.'"
						>Export as GPX track</b-dropdown-item>
						<b-dropdown-item
							href="javascript:"
							@click="exportRoute('gpx-rte')"
							v-b-tooltip.hover.right="'GPX files can be opened with most navigation software. In route mode, only the start/end/via points are saved in the file, and the navigation software needs to calculate the route.'"
						>Export as GPX route</b-dropdown-item>
					</b-dropdown>
				</b-button-toolbar>
			</template>
		</b-form>
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

		.form-group {
			margin-bottom: 0;

			&.active .input-group {
				box-shadow: 0 0 3px;
				border-radius: 0.25rem;
			}
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
		display: grid !important;
		grid-template-columns: auto 1fr;

		opacity: 0.6;

		&.isPending {
			display: flex !important;
			align-items: center;
			justify-content: center;
		}

		.dropdown-item {
			padding: 0.25rem 0.75rem 0.25rem 0.25rem;
		}

		.fm-route-form-suggestions-zoom .dropdown-item {
			padding: 0.25rem 0.25rem 0.25rem 0.75rem;
		}

		.fm-route-form-suggestions-divider {
			grid-column: 1 / span 2;
		}
	}
</style>