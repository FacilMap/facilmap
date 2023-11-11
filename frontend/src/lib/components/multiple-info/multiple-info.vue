<script setup lang="ts">
	import type { ID, Line, Marker } from "facilmap-types";
	import { combineZoomDestinations, flyTo, getZoomDestinationForLine, getZoomDestinationForMarker } from "../../utils/zoom";
	import Icon from "../ui/icon.vue";
	import { isLine, isMarker } from "../../utils/utils";
	import MarkerInfo from "../marker-info/marker-info.vue";
	import LineInfo from "../line-info/line-info.vue";
	import { computed, ref, watch } from "vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { showConfirm } from "../ui/alert.vue";
	import { useCarousel } from "../../utils/carousel";
	import ZoomToObjectButton from "../ui/zoom-to-object-button.vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import vTooltip from "../../utils/tooltip";
	import { normalizeLineName, normalizeMarkerName } from "facilmap-utils";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);
	const toasts = useToasts();

	const props = defineProps<{
		objects: Array<Marker | Line>;
	}>();

	const emit = defineEmits<{
		"click-object": [object: Marker | Line, event: MouseEvent];
	}>();

	const isDeleting = ref(false);
	const openedObjectId = ref<ID>();
	const openedObjectType = ref<"marker" | "line">();

	const carouselRef = ref<HTMLElement>();
	const carousel = useCarousel(carouselRef);

	function zoomToObject(object: Marker | Line): void {
		const zoomDestination = isMarker(object) ? getZoomDestinationForMarker(object) : isLine(object) ? getZoomDestinationForLine(object) : undefined;
		if (zoomDestination)
			flyTo(mapContext.value.components.map, zoomDestination);
	}

	function openObject(object: Marker | Line): void {
		openedObjectId.value = object.id;
		openedObjectType.value = isMarker(object) ? "marker" : isLine(object) ? "line" : undefined;
		carousel.setTab(1);
	}

	const openedObject = computed(() => {
		let openedObject: Marker | Line | undefined = undefined;
		if (openedObjectId.value != null) {
			if (openedObjectType.value == "marker")
				openedObject = client.value.markers[openedObjectId.value];
			else if (openedObjectType.value == "line")
				openedObject = client.value.lines[openedObjectId.value];
		}

		return openedObject && props.objects.includes(openedObject) ? openedObject : undefined;
	});

	watch(openedObject, () => {
		if (!openedObject.value)
			carousel.setTab(0);
	});

	async function deleteObjects(): Promise<void> {
		toasts.hideToast(`fm${context.id}-multiple-info-delete`);

		if (!props.objects || !await showConfirm({
			title: "Delete objects",
			message: `Do you really want to remove ${props.objects.length} objects?`,
			variant: "danger",
			okLabel: "Delete"
		}))
			return;

		isDeleting.value = true;

		try {
			for (const object of props.objects) {
				if (isMarker(object))
					await client.value.deleteMarker({ id: object.id });
				else if (isLine(object))
					await client.value.deleteLine({ id: object.id });
			}
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-multiple-info-delete`, "Error deleting objects", err);
		} finally {
			isDeleting.value = false;
		}
	}

	const zoomDestination = computed(() => {
		return combineZoomDestinations(props.objects.map((object) => {
			if (isMarker(object))
				return getZoomDestinationForMarker(object);
			else if (isLine(object))
				return getZoomDestinationForLine(object);
			else
				return undefined;
		}));
	});
</script>

<template>
	<div class="fm-multiple-info">
		<div class="carousel slide fm-flex-carousel" ref="carouselRef">
			<div class="carousel-item" :class="{ active: carousel.tab === 0 }">
				<ul class="list-group fm-search-box-collapse-point">
					<li v-for="object in props.objects" :key="`${isMarker(object) ? 'm' : 'l'}-${object.id}`" class="list-group-item active">
						<span>
							<a href="javascript:" @click="emit('click-object', object, $event)">{{isMarker(object) ? normalizeMarkerName(object.name) : normalizeLineName(object.name)}}</a>
							{{" "}}
							<span class="result-type" v-if="client.types[object.typeId]">({{client.types[object.typeId].name}})</span>
						</span>
						<a href="javascript:" @click="zoomToObject(object)" v-tooltip.left="'Zoom to object'"><Icon icon="zoom-in" alt="Zoom"></Icon></a>
						<a href="javascript:" @click="openObject(object)" v-tooltip.right="'Show details'"><Icon icon="arrow-right" alt="Details"></Icon></a>
					</li>
				</ul>

				<div class="btn-toolbar mt-2">
					<ZoomToObjectButton
						v-if="zoomDestination"
						label="selection"
						size="sm"
						:destination="zoomDestination"
					></ZoomToObjectButton>

					<button
						v-if="!client.readonly"
						type="button"
						class="btn btn-secondary btn-sm"
						@click="deleteObjects()"
						:disabled="isDeleting || mapContext.interaction"
					>
						<div v-if="isDeleting" class="spinner-border spinner-border-sm"></div>
						Delete
					</button>
				</div>
			</div>

			<div class="carousel-item" :class="{ active: carousel.tab === 1 }">
				<MarkerInfo
					v-if="openedObject && isMarker(openedObject)"
					:markerId="openedObject.id"
					show-back-button
					@back="carousel.setTab(0)"
				></MarkerInfo>
				<LineInfo
					v-else-if="openedObject && isLine(openedObject)"
					:lineId="openedObject.id"
					show-back-button
					@back="carousel.setTab(0)"
				></LineInfo>
			</div>
		</div>
	</div>
</template>

<style lang="scss">
	.fm-multiple-info {
		display: flex;
		flex-direction: column;
		min-height: 0;

		.list-group-item {
			display: flex;
			align-items: center;

			> :first-child {
				flex-grow: 1;
			}
		}
	}
</style>