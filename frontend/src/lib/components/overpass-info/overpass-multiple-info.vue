<script setup lang="ts">
	import { combineZoomDestinations, getZoomDestinationForMarker } from "../../utils/zoom";
	import OverpassInfo from "./overpass-info.vue";
	import type { OverpassElement } from "facilmap-leaflet";
	import { computed, ref } from "vue";
	import ZoomToObjectButton from "../ui/zoom-to-object-button.vue";
	import { getClientSub, injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { overpassElementsToMarkersWithTags } from "../../utils/add";
	import AddToMapDropdown from "../ui/add-to-map-dropdown.vue";
	import { formatPOIName } from "facilmap-utils";
	import { useI18n } from "../../utils/i18n";
	import { Writable } from "facilmap-types";
	import Carousel, { CarouselTab } from "../ui/carousel.vue";
	import type { ResultsItem } from "../ui/results.vue";
	import Results from "../ui/results.vue";

	const context = injectContextRequired();
	const clientSub = getClientSub(context);
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const props = defineProps<{
		elements: OverpassElement[];
	}>();

	const emit = defineEmits<{
		"click-element": [element: OverpassElement, toggle: boolean];
	}>();

	const openedElement = ref<OverpassElement>();

	const carouselRef = ref<typeof Carousel>();

	const elementItems = computed(() => props.elements.map((element): ResultsItem<OverpassElement> => ({
		key: element.id,
		object: element,
		label: formatPOIName(element.tags.name),
		zoomDestination: getZoomDestinationForMarker(element),
		zoomTooltip: i18n.t('overpass-multiple-info.zoom-to-object'),
		canOpen: true,
		openTooltip: i18n.t('overpass-multiple-info.show-details')
	})));

	function openElement(element: OverpassElement): void {
		openedElement.value = element;
		setTimeout(() => {
			carouselRef.value!.setTab(1);
		}, 0);
	}

	const markersWithTags = computed(() => overpassElementsToMarkersWithTags(props.elements));

	const zoomDestination = computed(() => combineZoomDestinations(props.elements.map((element) => getZoomDestinationForMarker(element))));
</script>

<template>
	<div class="fm-overpass-multiple-info">
		<template v-if="elements.length == 1">
			<OverpassInfo :element="elements[0]" :zoom="mapContext.zoom"></OverpassInfo>
		</template>
		<template v-else>
			<Carousel ref="carouselRef">
				<CarouselTab>
					<Results
						:items="elementItems"
						:active="props.elements"
						@select="(element, toggle) => emit('click-element', element, toggle)"
						@open="(element) => openElement(element)"
					></Results>

					<div class="btn-toolbar mt-2">
						<ZoomToObjectButton
							v-if="zoomDestination"
							:label="i18n.t('overpass-multiple-info.zoom-to-object-label')"
							size="sm"
							:destination="zoomDestination"
						></ZoomToObjectButton>

						<template v-if="clientSub && clientSub.data.mapData.writable !== Writable.READ">
							<AddToMapDropdown
								:markers="markersWithTags"
								size="sm"
							></AddToMapDropdown>
						</template>
					</div>
				</CarouselTab>

				<CarouselTab v-if="openedElement">
					<OverpassInfo
						:element="openedElement"
						show-back-button
						:zoom="mapContext.zoom"
						@back="carouselRef!.setTab(0)"
					></OverpassInfo>
				</CarouselTab>
			</Carousel>
		</template>
	</div>
</template>