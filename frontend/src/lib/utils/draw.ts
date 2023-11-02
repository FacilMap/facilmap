import { addClickListener } from "facilmap-leaflet";
import type { ID, Type } from "facilmap-types";
import { getUniqueId } from "./utils";
import type { ToastContext } from "../components/ui/toasts/toasts.vue";
import type { Client } from "../components/client-context.vue";
import type { MapContext } from "../components/leaflet-map/leaflet-map.vue";

export function drawMarker(type: Type, client: Client, mapContext: MapContext, toasts: ToastContext): void {
	const clickListener = addClickListener(mapContext.components.map, async (point) => {
		toasts.hideToast("fm-draw-add-marker");

		try {
			const marker = await client.addMarker({
				lat: point.lat,
				lon: point.lon,
				typeId: type.id
			});

			mapContext.components.selectionHandler.setSelectedItems([{ type: "marker", id: marker.id }], true);

			if (!mapContext.components.map.fmFilterFunc(marker, client.types[marker.typeId]))
				toasts.showToast(getUniqueId("fm-draw-add-marker"), `${type.name} successfully added`, "The marker was successfully added, but the active filter is preventing it from being shown.", { variant: "success", noCloseButton: false });
		} catch (err) {
			toasts.showErrorToast("fm-draw-add-marker", "Error adding marker", err);
		}
	});

	toasts.showToast("fm-draw-add-marker", `Add ${type.name}`, "Please click on the map to add a marker.", {
		actions: [
			{ label: "Cancel", onClick: () => {
				toasts.hideToast("fm-draw-add-marker");
				clickListener.cancel();
			} }
		]
	});
}

export function moveMarker(markerId: ID, client: Client, mapContext: MapContext, toasts: ToastContext): void {
	const markerLayer = mapContext.components.markersLayer.markersById[markerId];
	if(!markerLayer)
		return;

	toasts.hideToast("fm-draw-drag-marker");

	mapContext.components.map.fire('fmInteractionStart');
	mapContext.components.markersLayer.lockMarker(markerId);

	async function finish(save: boolean) {
		toasts.hideToast("fm-draw-drag-marker");

		markerLayer.dragging!.disable();

		if(save) {
			try {
				const pos = markerLayer.getLatLng();
				await client.editMarker({ id: markerId, lat: pos.lat, lon: pos.lng });
			} catch (err) {
				toasts.showErrorToast("fm-draw-drag-marker", "Error moving marker", err);
			}
		}

		mapContext.components.markersLayer.unlockMarker(markerId);
		mapContext.components.map.fire('fmInteractionEnd');
	}

	toasts.showToast("fm-draw-drag-marker", "Drag marker", "Drag the marker to reposition it.", {
		actions: [
			{ label: "Save", onClick: () => {
				finish(true);
			}},
			{ label: "Cancel", onClick: () => {
				finish(false);
			} }
		]
	});

	markerLayer.dragging!.enable();
}

export async function drawLine(type: Type, client: Client, mapContext: MapContext, toasts: ToastContext): Promise<void> {
	try {
		toasts.hideToast("fm-draw-add-line");

		const lineTemplate = await client.getLineTemplate({ typeId: type.id });

		toasts.showToast("fm-draw-add-line", `Add ${type.name}`, "Click on the map to draw a line. Click “Finish” to save it.", {
			actions: [
				{ label: "Finish", onClick: () => {
					mapContext.components.linesLayer.endDrawLine(true);
				}},
				{ label: "Cancel", onClick: () => {
					mapContext.components.linesLayer.endDrawLine(false);
				} }
			]
		});

		const routePoints = await mapContext.components.linesLayer.drawLine(lineTemplate);

		toasts.hideToast("fm-draw-add-line");

		if (routePoints) {
			const line = await client.addLine({ typeId: type.id, routePoints });
			mapContext.components.selectionHandler.setSelectedItems([{ type: "line", id: line.id }], true);

			if (!mapContext.components.map.fmFilterFunc(line, client.types[line.typeId]))
				toasts.showToast(getUniqueId("fm-draw-add-line"), `${type.name} successfully added`, "The line was successfully added, but the active filter is preventing it from being shown.", { variant: "success", noCloseButton: false });
		}
	} catch (err) {
		toasts.showErrorToast("fm-draw-add-line", "Error adding line", err);
	}
}