<script setup lang="ts">
	import { combineZoomDestinations, flyTo, getZoomDestinationForMarker } from "../../utils/zoom";
	import Icon from "../ui/icon.vue";
	import OverpassInfo from "./overpass-info.vue";
	import type { OverpassElement } from "facilmap-leaflet";
	import vTooltip from "../../utils/tooltip";
	import { computed, ref } from "vue";
	import { useCarousel } from "../../utils/carousel";
	import ZoomToObjectButton from "../ui/zoom-to-object-button.vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { overpassElementsToMarkersWithTags } from "../../utils/add";
	import AddToMapDropdown from "../ui/add-to-map-dropdown.vue";
	import { formatPOIName } from "facilmap-utils";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const props = defineProps<{
		elements: OverpassElement[];
	}>();

	const emit = defineEmits<{
		"click-element": [element: OverpassElement, event: MouseEvent];
	}>();

	const openedElement = ref<OverpassElement>();

	const carouselRef = ref<HTMLElement>();
	const carousel = useCarousel(carouselRef);

	function zoomToElement(element: OverpassElement): void {
		const zoomDestination = getZoomDestinationForMarker(element);
		if (zoomDestination)
			flyTo(mapContext.value.components.map, zoomDestination);
	}

	function openElement(element: OverpassElement): void {
		openedElement.value = element;
		carousel.setTab(1);
	}

	const markersWithTags = computed(() => overpassElementsToMarkersWithTags(props.elements));

	const zoomDestination = computed(() => combineZoomDestinations(props.elements.map((element) => getZoomDestinationForMarker(element))));
</script>

<template>
	<div class="fm-overpass-multiple-info">
		<template v-if="elements.length == 1">
			<OverpassInfo :element="elements[0]"></OverpassInfo>
		</template>
		<template v-else>
			<div class="carousel slide" ref="carouselRef">
				<div class="carousel-item" :class="{ active: carousel.tab === 0 }">
					<ul class="list-group">
						<li v-for="element in elements" :key="element.id" class="list-group-item active">
							<span>
								<a href="javascript:" @click="emit('click-element', element, $event)">{{formatPOIName(element.tags.name)}}</a>
							</span>
							<a href="javascript:" @click="zoomToElement(element)" v-tooltip.left="i18n.t('overpass-multiple-info.zoom-to-object')"><Icon icon="zoom-in" :alt="i18n.t('overpass-multiple-info.zoom')"></Icon></a>
							<a href="javascript:" @click="openElement(element)" v-tooltip.right="i18n.t('overpass-multiple-info.show-details')"><Icon icon="arrow-right" :alt="i18n.t('overpass-multiple-info.details')"></Icon></a>
						</li>
					</ul>

					<div v-if="client.mapData && !client.readonly" class="btn-toolbar mt-2">
						<ZoomToObjectButton
							v-if="zoomDestination"
							:label="i18n.t('overpass-multiple-info.zoom-to-object-label')"
							size="sm"
							:destination="zoomDestination"
						></ZoomToObjectButton>

						<AddToMapDropdown
							:markers="markersWithTags"
							size="sm"
						></AddToMapDropdown>
					</div>
				</div>

				<div class="carousel-item" :class="{ active: carousel.tab === 1 }">
					<OverpassInfo
						v-if="openedElement"
						:element="openedElement"
						show-back-button
						@back="carousel.setTab(0)"
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