import { addClickListener } from "facilmap-leaflet";
import type { ID, Type } from "facilmap-types";
import type { ToastContext } from "../components/ui/toasts/toasts.vue";
import type { FacilMapContext } from "../components/facil-map-context-provider/facil-map-context";
import { requireClientContext, requireMapContext } from "../components/facil-map-context-provider/facil-map-context-provider.vue";
import { addToMap } from "./add";
import { formatTypeName } from "facilmap-utils";
import { getI18n } from "./i18n";
import { reactive, toRef } from "vue";

export function drawMarker(type: Type, context: FacilMapContext, toasts: ToastContext): void {
	const mapContext = requireMapContext(context);
	const clickListener = addClickListener(mapContext.value.components.map, async (point) => {
		toasts.hideToast("fm-draw-add-marker");

		if (point) {
			try {
				const selection = await addToMap(context, [
					{ marker: { lat: point.lat, lon: point.lon }, type }
				]);

				mapContext.value.components.selectionHandler.setSelectedItems(selection, true);
			} catch (err) {
				toasts.showErrorToast("fm-draw-add-marker", () => getI18n().t("draw.add-marker-error"), err);
			}
		}
	});

	toasts.showToast("fm-draw-add-marker", () => getI18n().t("draw.add-marker-title", { typeName: formatTypeName(type.name) }), () => getI18n().t("draw.add-marker-message"), reactive({
		noCloseButton: true,
		actions: [
			{
				label: toRef(() => getI18n().t("draw.add-marker-cancel")),
				onClick: () => {
					clickListener.cancel();
				}
			}
		]
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

	const finish = async (save: boolean) => {
		toasts.hideToast("fm-draw-drag-marker");

		markerLayer.dragging!.disable();

		if(save) {
			try {
				const pos = markerLayer.getLatLng();
				await client.value.editMarker({ id: markerId, lat: pos.lat, lon: pos.lng });
			} catch (err) {
				toasts.showErrorToast("fm-draw-drag-marker", () => getI18n().t("draw.move-marker-error"), err);
			}
		}

		mapContext.value.components.markersLayer.unlockMarker(markerId);
		mapContext.value.components.map.fire('fmInteractionEnd');
	};

	toasts.showToast("fm-draw-drag-marker", () => getI18n().t("draw.move-marker-title"), getI18n().t("draw.move-marker-message"), reactive({
		noCloseButton: true,
		actions: [
			{
				label: toRef(() => getI18n().t("draw.move-marker-save")),
				variant: "primary" as const,
				onClick: () => {
					void finish(true);
				}
			},
			{
				label: toRef(() => getI18n().t("draw.move-marker-cancel")),
				onClick: () => {
					void finish(false);
				}
			}
		]
	}));

	markerLayer.dragging!.enable();
}

export async function drawLine(type: Type, context: FacilMapContext, toasts: ToastContext): Promise<void> {
	try {
		toasts.hideToast("fm-draw-add-line");

		const mapContext = requireMapContext(context);
		const client = requireClientContext(context);

		const lineTemplate = await client.value.getLineTemplate({ typeId: type.id });

		toasts.showToast("fm-draw-add-line", () => getI18n().t("draw.add-line-title", { typeName: formatTypeName(type.name) }), () => getI18n().t("draw.add-line-message"), reactive({
			noCloseButton: true,
			actions: [
				{
					label: toRef(() => getI18n().t("draw.add-line-finish")),
					variant: "primary" as const,
					onClick: () => {
						mapContext.value.components.linesLayer.endDrawLine(true);
					}
				},
				{
					label: toRef(() => getI18n().t("draw.add-line-cancel")),
					onClick: () => {
						mapContext.value.components.linesLayer.endDrawLine(false);
					}
				}
			]
		}));

		const routePoints = await mapContext.value.components.linesLayer.drawLine(lineTemplate);

		toasts.hideToast("fm-draw-add-line");

		if (routePoints) {
			const selection = await addToMap(context, [
				{ line: { routePoints }, type }
			]);
			mapContext.value.components.selectionHandler.setSelectedItems(selection, true);
		}
	} catch (err) {
		toasts.showErrorToast("fm-draw-add-line", getI18n().t("draw.add-line-error"), err);
	}
}