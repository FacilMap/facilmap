<script setup lang="ts">
	import { combineZoomDestinations, flyTo, getZoomDestinationForMarker } from "../../utils/zoom";
	import Icon from "../ui/icon.vue";
	import OverpassInfo from "./overpass-info.vue";
	import type { OverpassElement } from "facilmap-leaflet";
	import type { CRU, Marker, Type } from "facilmap-types";
	import type { SelectedItem } from "../../utils/selection";
	import { mapTagsToType } from "../search-results/utils";
	import vTooltip from "../../utils/tooltip";
	import { computed, ref } from "vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { useCarousel } from "../../utils/carousel";
	import ZoomToObjectButton from "../ui/zoom-to-object-button.vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);
	const toasts = useToasts();

	const props = defineProps<{
		elements: OverpassElement[];
	}>();

	const emit = defineEmits<{
		"click-element": [element: OverpassElement, event: MouseEvent];
	}>();

	const openedElement = ref<OverpassElement>();
	const isAdding = ref(false);

	const carouselRef = ref<HTMLElement>();
	const carousel = useCarousel(carouselRef);

	const types = computed(() => {
		return Object.values(client.value.types).filter((type) => type.type == "marker");
	});

	function zoomToElement(element: OverpassElement): void {
		const zoomDestination = getZoomDestinationForMarker(element);
		if (zoomDestination)
			flyTo(mapContext.value.components.map, zoomDestination);
	}

	function openElement(element: OverpassElement): void {
		openedElement.value = element;
		carousel.setTab(1);
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

				const marker = await client.value.addMarker({
					...obj,
					lat: element.lat,
					lon: element.lon,
					typeId: type.id
				});

				selection.push({ type: "marker", id: marker.id });
			}

			mapContext.value.components.selectionHandler.setSelectedItems(selection, true);
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-overpass-multiple-info-add-error`, "Error adding to map", err);
		} finally {
			isAdding.value = false;
		}
	}

	const zoomDestination = computed(() => combineZoomDestinations(props.elements.map((element) => getZoomDestinationForMarker(element))));
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
					<ul class="list-group">
						<li v-for="element in elements" :key="element.id" class="list-group-item active">
							<span>
								<a href="javascript:" @click="emit('click-element', element, $event)">{{element.tags.name || 'Unnamed POI'}}</a>
							</span>
							<a href="javascript:" @click="zoomToElement(element)" v-tooltip.left="'Zoom to object'"><Icon icon="zoom-in" alt="Zoom"></Icon></a>
							<a href="javascript:" @click="openElement(element)" v-tooltip.right="'Show details'"><Icon icon="arrow-right" alt="Details"></Icon></a>
						</li>
					</ul>

					<div v-if="client.padData && !client.readonly" class="btn-group">
						<ZoomToObjectButton
							v-if="zoomDestination"
							label="selection"
							size="sm"
							:destination="zoomDestination"
						></ZoomToObjectButton>

						<DropdownMenu
							v-if="client.padData && !client.readonly && types.length > 0"
							:isBusy="isAdding"
							label="Add to map"
						>
							<template v-for="type in types" :key="type.id">
								<li>
									<a
										href="javascript:"
										class="dropdown-item"
										@click="addToMap(elements, type)"
									>{{type.name}}</a>
								</li>
							</template>
						</DropdownMenu>
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
		.list-group-item {
			display: flex;
			align-items: center;

			> :first-child {
				flex-grow: 1;
			}
		}
	}
</style>