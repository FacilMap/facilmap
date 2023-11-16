import { addClickListener } from "facilmap-leaflet";
import type { ID, Type } from "facilmap-types";
import type { ToastContext } from "../components/ui/toasts/toasts.vue";
import type { FacilMapContext } from "../components/facil-map-context-provider/facil-map-context";
import { requireClientContext, requireMapContext } from "../components/facil-map-context-provider/facil-map-context-provider.vue";
import { addToMap } from "./add";

export function drawMarker(type: Type, context: FacilMapContext, toasts: ToastContext): void {
	const mapContext = requireMapContext(context);
	const clickListener = addClickListener(mapContext.value.components.map, async (point) => {
		toasts.hideToast("fm-draw-add-marker");

		try {
			const selection = await addToMap(context, [
				{ marker: { lat: point.lat, lon: point.lon }, type }
			]);

			mapContext.value.components.selectionHandler.setSelectedItems(selection, true);
		} catch (err) {
			toasts.showErrorToast("fm-draw-add-marker", "Error adding marker", err);
		}
	});

	toasts.showToast("fm-draw-add-marker", `Add ${type.name}`, "Please click on the map to add a marker.", {
		noCloseButton: true,
		actions: [
			{
				label: "Cancel",
				onClick: () => {
					toasts.hideToast("fm-draw-add-marker");
					clickListener.cancel();
				}
			}
		]
	});
}

export function moveMarker(markerId: ID, context: FacilMapContext, toasts: ToastContext): void {
	const mapContext = requireMapContext(context);
	const client = requireClientContext(context);

	const markerLayer = mapContext.value.components.markersLayer.markersById[markerId];
	if(!markerLayer)
		return;

	toasts.hideToast("fm-draw-drag-marker");

	mapContext.value.components.map.fire('fmInteractionStart');
	mapContext.value.components.markersLayer.lockMarker(markerId);

	async function finish(save: boolean) {
		toasts.hideToast("fm-draw-drag-marker");

		markerLayer.dragging!.disable();

		if(save) {
			try {
				const pos = markerLayer.getLatLng();
				await client.value.editMarker({ id: markerId, lat: pos.lat, lon: pos.lng });
			} catch (err) {
				toasts.showErrorToast("fm-draw-drag-marker", "Error moving marker", err);
			}
		}

		mapContext.value.components.markersLayer.unlockMarker(markerId);
		mapContext.value.components.map.fire('fmInteractionEnd');
	}

	toasts.showToast("fm-draw-drag-marker", "Drag marker", "Drag the marker to reposition it.", {
		noCloseButton: true,
		actions: [
			{
				label: "Save",
				variant: "primary",
				onClick: () => {
					finish(true);
				}
			},
			{
				label: "Cancel",
				onClick: () => {
					finish(false);
				}
			}
		]
	});

	markerLayer.dragging!.enable();
}

export async function drawLine(type: Type, context: FacilMapContext, toasts: ToastContext): Promise<void> {
	try {
		toasts.hideToast("fm-draw-add-line");

		const mapContext = requireMapContext(context);
		const client = requireClientContext(context);

		const lineTemplate = await client.value.getLineTemplate({ typeId: type.id });

		toasts.showToast("fm-draw-add-line", `Add ${type.name}`, "Click on the map to draw a line. Click “Finish” to save it.", {
			noCloseButton: true,
			actions: [
				{
					label: "Finish",
					variant: "primary",
					onClick: () => {
						mapContext.value.components.linesLayer.endDrawLine(true);
					}
				},
				{
					label: "Cancel",
					onClick: () => {
						mapContext.value.components.linesLayer.endDrawLine(false);
					}
				}
			]
		});

		const routePoints = await mapContext.value.components.linesLayer.drawLine(lineTemplate);

		toasts.hideToast("fm-draw-add-line");

		if (routePoints) {
			const selection = await addToMap(context, [
				{ line: { routePoints }, type }
			]);
			mapContext.value.components.selectionHandler.setSelectedItems(selection, true);
		}
	} catch (err) {
		toasts.showErrorToast("fm-draw-add-line", "Error adding line", err);
	}
}