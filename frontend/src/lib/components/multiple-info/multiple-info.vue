<script setup lang="ts">
	import type { ID, Line, Marker } from "facilmap-types";
	import { combineZoomDestinations, getZoomDestinationForLine, getZoomDestinationForMarker } from "../../utils/zoom";
	import MarkerInfo from "../marker-info/marker-info.vue";
	import LineInfo from "../line-info/line-info.vue";
	import { computed, ref, type ComponentInstance, type DeepReadonly } from "vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { showConfirm } from "../ui/alert.vue";
	import ZoomToObjectButton from "../ui/zoom-to-object-button.vue";
	import { injectContextRequired, requireClientContext, requireClientSub, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { canUpdateObject, formatTypeName, isLine, isMarker, normalizeLineName, normalizeMarkerName } from "facilmap-utils";
	import { useI18n } from "../../utils/i18n";
	import type { ResultsItem } from "../ui/results.vue";
	import Results from "../ui/results.vue";
	import Carousel, { CarouselTab } from "../ui/carousel.vue";

	const context = injectContextRequired();
	const clientContext = requireClientContext(context);
	const clientSub = requireClientSub(context);
	const mapContext = requireMapContext(context);
	const toasts = useToasts();
	const i18n = useI18n();

	const props = defineProps<{
		objects: Array<DeepReadonly<Marker | Line>>;
	}>();

	const emit = defineEmits<{
		"click-object": [object: DeepReadonly<Marker | Line>, toggle: boolean];
	}>();

	const isDeleting = ref(false);
	const openedObjectId = ref<ID>();
	const openedObjectType = ref<"marker" | "line">();

	const carouselRef = ref<ComponentInstance<typeof Carousel>>();

	const objectItems = computed(() => props.objects.map((object): ResultsItem<DeepReadonly<Marker | Line>> => ({
		key: `${isMarker(object) ? 'm' : 'l'}-${object.id}`,
		object,
		label: isMarker(object) ? normalizeMarkerName(object.name) : normalizeLineName(object.name),
		labelSuffix: clientSub.value.data.types[object.typeId] && formatTypeName(clientSub.value.data.types[object.typeId].name),
		zoomDestination: isMarker(object) ? getZoomDestinationForMarker(object) : isLine(object) ? getZoomDestinationForLine(object) : undefined,
		zoomTooltip: i18n.t('multiple-info.zoom-to-object'),
		canOpen: true,
		openTooltip: i18n.t('multiple-info.show-details')
	})));

	function openObject(object: DeepReadonly<Marker | Line>): void {
		openedObjectId.value = object.id;
		openedObjectType.value = isMarker(object) ? "marker" : isLine(object) ? "line" : undefined;
		setTimeout(() => {
			carouselRef.value!.setTab(1);
		}, 0);
	}

	const openedObject = computed(() => {
		let openedObject: DeepReadonly<Marker | Line> | undefined = undefined;
		if (openedObjectId.value != null) {
			if (openedObjectType.value == "marker")
				openedObject = clientSub.value.data.markers[openedObjectId.value];
			else if (openedObjectType.value == "line")
				openedObject = clientSub.value.data.lines[openedObjectId.value];
		}

		return openedObject && props.objects.includes(openedObject) ? openedObject : undefined;
	});

	const canDelete = computed(() => props.objects.some((object) => {
		const type = clientSub.value.data.types[object.typeId];
		return !!type && canUpdateObject(clientSub.value.data.mapData, type, object);
	}));

	async function deleteObjects(): Promise<void> {
		toasts.hideToast(`fm${context.id}-multiple-info-delete`);

		if (!props.objects || !await showConfirm({
			title: i18n.t("multiple-info.delete-objects-title", { count: props.objects.length }),
			message: i18n.t("multiple-info.delete-objects-message", { count: props.objects.length }),
			variant: "danger",
			okLabel: i18n.t("multiple-info.delete-objects-ok")
		}))
			return;

		isDeleting.value = true;

		try {
			for (const object of props.objects) {
				if (isMarker(object))
					await clientContext.value.client.deleteMarker(clientSub.value.mapSlug, object.id);
				else if (isLine(object))
					await clientContext.value.client.deleteLine(clientSub.value.mapSlug, object.id);
			}
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-multiple-info-delete`, () => i18n.t("multiple-info.delete-objects-error"), err);
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
		<Carousel ref="carouselRef">
			<CarouselTab>
				<Results
					class="fm-search-box-collapse-point"
					:items="objectItems"
					:active="props.objects"
					@select="(object, toggle) => emit('click-object', object, toggle)"
					@open="(object) => openObject(object)"
				></Results>

				<div class="btn-toolbar mt-2">
					<ZoomToObjectButton
						v-if="zoomDestination"
						:label="i18n.t('multiple-info.zoom-to-object-label')"
						size="sm"
						:destination="zoomDestination"
					></ZoomToObjectButton>

					<button
						v-if="canDelete"
						type="button"
						class="btn btn-secondary btn-sm"
						@click="deleteObjects()"
						:disabled="isDeleting || mapContext.interaction"
					>
						<div v-if="isDeleting" class="spinner-border spinner-border-sm"></div>
						{{i18n.t("multiple-info.delete")}}
					</button>
				</div>
			</CarouselTab>

			<CarouselTab v-if="openedObject">
				<MarkerInfo
					v-if="isMarker(openedObject)"
					:markerId="openedObject.id"
					show-back-button
					:zoom="mapContext.zoom"
					@back="carouselRef!.setTab(0)"
				></MarkerInfo>
				<LineInfo
					v-else-if="isLine(openedObject)"
					:lineId="openedObject.id"
					show-back-button
					@back="carouselRef!.setTab(0)"
				></LineInfo>
			</CarouselTab>
		</Carousel>
	</div>
</template>

<style lang="scss">
	.fm-multiple-info {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
</style>