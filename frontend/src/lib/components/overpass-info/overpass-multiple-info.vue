<script setup lang="ts">
	import { combineZoomDestinations, flyTo, getZoomDestinationForMarker } from "../../utils/zoom";
	import Icon from "../ui/icon.vue";
	import OverpassInfo from "./overpass-info.vue";
	import type { OverpassElement } from "facilmap-leaflet";
	import type { CRU, Marker, Type } from "facilmap-types";
	import type { SelectedItem } from "../../utils/selection";
	import { mapTagsToType } from "../search-results/utils";
	import vTooltip from "../../utils/tooltip";
	import { injectContextRequired } from "../../utils/context";
	import { injectClientRequired } from "../client-context.vue";
	import { injectMapContextRequired } from "../leaflet-map/leaflet-map.vue";
	import { computed, ref } from "vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { useCarousel } from "../../utils/carousel";

	const context = injectContextRequired();
	const client = injectClientRequired();
	const mapContext = injectMapContextRequired();
	const toasts = useToasts();

	const props = defineProps<{
		elements: OverpassElement[];
	}>();

	const openedElement = ref<OverpassElement>();
	const isAdding = ref(false);

	const carouselRef = ref<HTMLElement>();
	const carousel = useCarousel(carouselRef);

	const types = computed(() => {
		return Object.values(client.types).filter((type) => type.type == "marker");
	});

	function zoomToElement(element: OverpassElement): void {
		const zoomDestination = getZoomDestinationForMarker(element);
		if (zoomDestination)
			flyTo(mapContext.components.map, zoomDestination);
	}

	function openElement(element: OverpassElement): void {
		openedElement.value = element;
		carousel.setTab(1);
	}

	function zoom(): void {
		const zoomDestination = combineZoomDestinations(props.elements.map((element) => getZoomDestinationForMarker(element)));
		if (zoomDestination)
			flyTo(mapContext.components.map, zoomDestination);
	}

	async function addToMap(elements: OverpassElement[], type: Type): Promise<void> {
		toasts.hideToast(`fm${context.id}-overpass-multiple-info-add-error`);
		isAdding.value = true;

		try {
			const selection: SelectedItem[] = [];

			for (const element of elements) {
				const obj: Partial<Marker<CRU.CREATE>> = {
					name: element.tags.name || "",
					data: mapTagsToType(element.tags || {}, type)
				};

				const marker = await client.addMarker({
					...obj,
					lat: element.lat,
					lon: element.lon,
					typeId: type.id
				});

				selection.push({ type: "marker", id: marker.id });
			}

			mapContext.components.selectionHandler.setSelectedItems(selection, true);
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-overpass-multiple-info-add-error`, "Error adding to map", err);
		} finally {
			isAdding.value = false;
		}
	}
</script>

<template>
	<div class="fm-overpass-multiple-info">
		<template v-if="elements.length == 1">
			<OverpassInfo
				:element="elements[0]"
				:is-adding="isAdding"
				@add-to-map="addToMap(elements, $event)"
			></OverpassInfo>
		</template>
		<template v-else>
			<div class="carousel slide" ref="carouselRef">
				<div class="carousel-item" :class="{ active: carousel.tab === 0 }">
					<div class="fm-search-box-collapse-point">
						<ul class="list-group">
							<li v-for="element in elements" :key="element.id" class="list-group-item active">
								<span>
									<a href="javascript:" @click="$emit('click-element', element, $event)">{{element.tags.name || 'Unnamed POI'}}</a>
								</span>
								<a href="javascript:" @click="zoomToElement(element)" v-tooltip.left="'Zoom to object'"><Icon icon="zoom-in" alt="Zoom"></Icon></a>
								<a href="javascript:" @click="openElement(element)" v-tooltip.right="'Show details'"><Icon icon="arrow-right" alt="Details"></Icon></a>
							</li>
						</ul>
					</div>

					<div v-if="client.padData && !client.readonly" class="btn-group">
						<button
							type="button"
							class="btn btn-light btn-sm"
							v-tooltip="'Zoom to selection'"
							@click="zoom()"
						>
							<Icon icon="zoom-in" alt="Zoom to selection"></Icon>
						</button>

						<div v-if="client.padData && !client.readonly && types.length > 0" class="dropdown">
							<button type="button" class="btn btn-light dropdown-toggle" :disabled="isAdding">
								<div v-if="isAdding" class="spinner-border spinner-border-sm"></div>
								Add to map
							</button>
							<ul class="dropdown-menu">
								<template v-for="type in types" :key="type.id">
									<li>
										<a
											href="javascript:"
											class="dropdown-item"
											@click="addToMap(elements, type)"
										>{{type.name}}</a>
									</li>
								</template>
							</ul>
						</div>
					</div>
				</div>

				<div class="carousel-item" :class="{ active: carousel.tab === 1 }">
					<OverpassInfo
						v-if="openedElement"
						:element="openedElement"
						show-back-button
						:is-adding="isAdding"
						@back="carousel.setTab(0)"
						@add-to-map="addToMap([openedElement], $event)"
					></OverpassInfo>
				</div>
			</div>
		</template>
	</div>
</template>

<style lang="scss">
	.fm-overpass-multiple-info {
		&, .carousel, .carousel-inner, .carousel-item.active, .carousel-item-prev, .carousel-item-next, .carousel-caption {
			display: flex;
			flex-direction: column;
			min-height: 0;
		}

		.carousel-item {
			float: none;
		}

		.carousel-inner {
			flex-direction: row;
		}

		.list-group-item {
			display: flex;
			align-items: center;

			> :first-child {
				flex-grow: 1;
			}
		}

		.list-group-item.active a {
			color: inherit;
		}

		.carousel-caption {
			position: static;
			padding: 0;
			color: inherit;
			text-align: inherit;
		}

		.fm-search-box-collapse-point {
			min-height: 3em;
		}

		.btn-toolbar {
			margin-top: 0.5rem;
		}
	}
</style>