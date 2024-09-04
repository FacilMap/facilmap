import { addClickListener } from "facilmap-leaflet";
import type { DeepReadonly, ID, Point, Type } from "facilmap-types";
import type { ToastContext } from "../components/ui/toasts/toasts.vue";
import type { FacilMapContext } from "../components/facil-map-context-provider/facil-map-context";
import { requireClientContext, requireMapContext } from "../components/facil-map-context-provider/facil-map-context-provider.vue";
import { addToMap } from "./add";
import { formatTypeName, getLineTemplate } from "facilmap-utils";
import { getI18n } from "./i18n";
import { reactive, ref, toRef } from "vue";

export function drawMarker(type: DeepReadonly<Type>, context: FacilMapContext, toasts: ToastContext): void {
	const mapContext = requireMapContext(context);

	const isSaving = ref(false);

	const create = async (point: Point | undefined) => {
		try {
			if (point) {
				isSaving.value = true;
				const selection = await addToMap(context, [
					{ marker: { lat: point.lat, lon: point.lon }, type }
				]);

				mapContext.value.components.selectionHandler.setSelectedItems(selection, true);
			}
			toasts.hideToast("fm-draw-add-marker");
		} catch (err) {
			toasts.showErrorToast("fm-draw-add-marker", () => getI18n().t("draw.add-marker-error"), err);
		}
	};

	const clickListener = addClickListener(mapContext.value.components.map, async (point) => {
		await create(point);
	});

	toasts.showToast("fm-draw-add-marker", () => getI18n().t("draw.add-marker-title", { typeName: formatTypeName(type.name) }), () => getI18n().t("draw.add-marker-message"), reactive({
		noCloseButton: true,
		actions: toRef(() => [
			...mapContext.value.location ? [{
				label: getI18n().t("draw.add-marker-current"),
				onClick: () => {
					clickListener.cancel();
					void create(mapContext.value.location!);
				},
				isDisabled: isSaving.value
			}] : [],
			{
				label: getI18n().t("draw.add-marker-cancel"),
				onClick: () => {
					clickListener.cancel();
				},
				isDisabled: isSaving.value
			}
		]),
		spinner: isSaving
	}));
}

export function moveMarker(markerId: ID, context: FacilMapContext, toasts: ToastContext): void {
	const mapContext = requireMapContext(context);
	const client = requireClientContext(context);

	const markerLayer = mapContext.value.components.markersLayer.getLayerByMarkerId(markerId);
	if(!markerLayer)
		return;

	toasts.hideToast("fm-draw-drag-marker");

	mapContext.value.components.map.fire('fmInteractionStart');
	mapContext.value.components.markersLayer.lockMarker(markerId);

	const isSaving = ref(false);

	const finish = async (pos: Point | undefined) => {
		markerLayer.dragging!.disable();

		try {
			if(pos) {
				isSaving.value = true;
				await client.value.editMarker({ id: markerId, lat: pos.lat, lon: pos.lon });
			}

			toasts.hideToast("fm-draw-drag-marker");
		} catch (err) {
			toasts.showErrorToast("fm-draw-drag-marker", () => getI18n().t("draw.move-marker-error"), err);
		}

		mapContext.value.components.markersLayer.unlockMarker(markerId);
		mapContext.value.components.map.fire('fmInteractionEnd');
	};

	toasts.showToast("fm-draw-drag-marker", () => getI18n().t("draw.move-marker-title"), getI18n().t("draw.move-marker-message"), reactive({
		noCloseButton: true,
		actions: toRef(() => [
			{
				label: getI18n().t("draw.move-marker-save"),
				variant: "primary" as const,
				onClick: () => {
					const pos = markerLayer.getLatLng()
					void finish({ lat: pos.lat, lon: pos.lng });
				},
				isPending: isSaving.value,
				isDisabled: isSaving.value
			},
			...mapContext.value.location ? [{
				label: getI18n().t("draw.move-marker-current"),
				onClick: () => {
					void finish(mapContext.value.location);
				},
				isDisabled: isSaving.value
			}] : [],
			{
				label: getI18n().t("draw.move-marker-cancel"),
				onClick: () => {
					void finish(undefined);
				},
				isDisabled: isSaving.value
			}
		])
	}));

	markerLayer.dragging!.enable();
}

export async function drawLine(type: DeepReadonly<Type>, context: FacilMapContext, toasts: ToastContext): Promise<void> {
	try {
		toasts.hideToast("fm-draw-add-line");

		const mapContext = requireMapContext(context);

		const lineTemplate = getLineTemplate(type);

		const isDisabled = ref(true);
		const isSaving = ref(false);
		toasts.showToast("fm-draw-add-line", () => getI18n().t("draw.add-line-title", { typeName: formatTypeName(type.name) }), () => getI18n().t("draw.add-line-message"), reactive({
			noCloseButton: true,
			actions: toRef(() => [
				{
					label: getI18n().t("draw.add-line-finish"),
					variant: "primary" as const,
					onClick: () => {
						mapContext.value.components.linesLayer.endDrawLine(true);
					},
					isDisabled: isDisabled.value || isSaving.value,
					isPending: isSaving.value
				},
				{
					label: getI18n().t("draw.add-line-cancel"),
					onClick: () => {
						mapContext.value.components.linesLayer.endDrawLine(false);
					},
					isDisabled: isSaving.value
				}
			])
		}));

		const routePoints = await mapContext.value.components.linesLayer.drawLine(lineTemplate, (point, points) => {
			isDisabled.value = points.length < 2;
		});

		try {
			if (routePoints) {
				isSaving.value = true;

				const selection = await addToMap(context, [
					{ line: { routePoints }, type }
				]);
				mapContext.value.components.selectionHandler.setSelectedItems(selection, true);
			}
		} finally {
			toasts.hideToast("fm-draw-add-line");
		}
	} catch (err) {
		toasts.showErrorToast("fm-draw-add-line", getI18n().t("draw.add-line-error"), err);
	}
}