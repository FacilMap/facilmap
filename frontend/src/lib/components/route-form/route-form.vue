<script setup lang="ts">
	import { type ComponentInstance, computed, nextTick, ref, toRaw, watch } from "vue";
	import Icon from "../ui/icon.vue";
	import { compileFormulaExpression, decodeRouteQuery, encodeRouteQuery, formatDistance, formatRouteMode, formatRouteTime, markdownInline, type StrippedTypeForFormula } from "facilmap-utils";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { type HashQuery } from "facilmap-leaflet";
	import { getZoomDestinationForRoute, flyTo, normalizeZoomDestination } from "../../utils/zoom";
	import RouteMode from "../ui/route-mode.vue";
	import { cloneDeep } from "lodash-es";
	import ElevationStats from "../ui/elevation-stats.vue";
	import ElevationPlot from "../ui/elevation-plot.vue";
	import type { LineWithTags } from "../../utils/add";
	import vTooltip from "../../utils/tooltip";
	import ZoomToObjectButton from "../ui/zoom-to-object-button.vue";
	import { UseAsType } from "../facil-map-context-provider/route-form-tab-context";
	import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import AddToMapDropdown from "../ui/add-to-map-dropdown.vue";
	import ExportDropdown from "../ui/export-dropdown.vue";
	import { useI18n } from "../../utils/i18n";
	import RouteFormDestinations from "./route-form-destinations.vue";
	import { getInitialDestinations, getSelectedSuggestion, getSelectedSuggestionId, getSelectedSuggestionName, useDestinationAs, makeDestination, type RouteFormDestination } from "./route-form-utils.js";
import { useMapLayer } from "../../utils/leaflet.js";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);

	const toasts = useToasts();
	const i18n = useI18n();

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

	const strippedType = computed(() => routeObj.value && client.value.mapData && client.value.mapData.routeFormulas.length > 0 ? {
		...routeObj.value,
		type: "route",
		fields: client.value.mapData.routeFormulas.map((f) => ({ type: "formula", name: f.name, formula: f.formula }))
	} satisfies StrippedTypeForFormula : undefined);
	const formulaResults = computed(() => strippedType.value ? strippedType.value.fields.flatMap((f) => {
		const value = compileFormulaExpression(f.formula, client.value.mapData?.customFunctions)(routeObj.value!, strippedType.value!);
		return value === "" ? [] : [{ name: f.name, valueHtml: markdownInline(value, true) }];
	}) : []);

	const routeMode = ref(routeObj.value?.mode ?? "car");
	const destinations = ref<RouteFormDestination[]>(getInitialDestinations(routeObj.value));
	const submittedQuery = ref<{ destinations: RouteFormDestination[]; mode: string }>();
	const routeError = ref<string>();

	const destinationsRef = ref<ComponentInstance<typeof RouteFormDestinations>>();

	const zoomDestination = computed(() => routeObj.value && getZoomDestinationForRoute(routeObj.value));

	const routeLayer = computed(() => {
		const layer = markRaw(new RouteLayer(client.value, props.routeId, { highlight: true }));
		layer.on("click", (e) => {
			if (!props.active && !(e.originalEvent as any).ctrlKey) {
				emit("activate");
			}
		});
		return layer;
	});

	useMapLayer(routeLayer);

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

	watch(hashQuery, (hashQuery) => {
		emit("hash-query-change", hashQuery);
	});

	watch(routeMode, () => {
		void reroute(false);
	});

	async function route(zoom: boolean, smooth = true): Promise<void> {
		reset();

		try {
			const mode = routeMode.value;

			submittedQuery.value = { destinations: cloneDeep(toRaw(destinations.value)), mode };

			await destinationsRef.value?.loadAllSuggestions();
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
			await destinationsRef.value?.loadAllSuggestions();
			const points = destinations.value.map((dest) => getSelectedSuggestion(dest));

			if(!points.some((point) => point == null))
				await route(zoom, smooth);
		}
	}

	function reset(): void {
		toasts.hideToast(`fm${context.id}-route-form-error`);
		submittedQuery.value = undefined;
		routeError.value = undefined;
		destinationsRef.value?.reset();
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

	async function getExport(format: "gpx-trk" | "gpx-rte"): Promise<string> {
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
		const result = useDestinationAs(destinations.value, makeDestination(data), as);
		destinations.value = result.destinations;
		void reroute(true);

		void nextTick(() => { // New destinations are rendered
			void nextTick(() => { // New destinations have been rendered, refs are available
				destinationsRef.value?.focusDestination(result.idx);
			});
		});
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
			<RouteFormDestinations
				ref="destinationsRef"
				:routeId="props.routeId"
				:active="props.active"
				:hasRouteError="!!routeError"
				v-model:destinations="destinations"
				@reroute="(zoom) => { reroute(zoom); }"
			></RouteFormDestinations>

			<div class="btn-toolbar">
				<button
					type="button"
					class="btn btn-secondary"
					@click="destinationsRef?.addDestination()"
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

					<template v-for="result in formulaResults" :key="result.name">
						<dt>{{result.name}}</dt>
						<dd v-html="result.valueHtml"></dd>
					</template>
				</dl>

				<ElevationPlot :route="routeObj" v-if="routeObj.ascent != null"></ElevationPlot>

				<div v-if="showToolbar" class="btn-toolbar fm-search-box-toolbar" role="group">
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
						:formats="['gpx-trk', 'gpx-rte']"
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