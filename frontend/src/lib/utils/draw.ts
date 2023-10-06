import { addClickListener } from "facilmap-leaflet";
import { ID, Type } from "facilmap-types";
import { getUniqueId } from "./utils";
import { hideToast, showErrorToast, showToast } from "../components/ui/toasts/toasts.vue";
import { Client } from "./client";
import { MapComponents } from "./map-components";

export function drawMarker(type: Type, client: Client, mapComponents: MapComponents): void {
	const clickListener = addClickListener(mapComponents.map, async (point) => {
		hideToast("fm-draw-add-marker");

		try {
			const marker = await client.addMarker({
				lat: point.lat,
				lon: point.lon,
				typeId: type.id
			});

			mapComponents.selectionHandler.setSelectedItems([{ type: "marker", id: marker.id }], true);

			if (!mapComponents.map.fmFilterFunc(marker, client.types[marker.typeId]))
				showToast(getUniqueId("fm-draw-add-marker"), `${type.name} successfully added`, "The marker was successfully added, but the active filter is preventing it from being shown.", { variant: "success", noCloseButton: false });
		} catch (err) {
			showErrorToast("fm-draw-add-marker", "Error adding marker", err);
		}
	});

	showToast("fm-draw-add-marker", `Add ${type.name}`, "Please click on the map to add a marker.", {
		actions: [
			{ label: "Cancel", onClick: () => {
				hideToast("fm-draw-add-marker");
				clickListener.cancel();
			} }
		]
	});
}

export function moveMarker(markerId: ID, client: Client, mapComponents: MapComponents): void {
	const markerLayer = mapComponents.markersLayer.markersById[markerId];
	if(!markerLayer)
		return;

	hideToast("fm-draw-drag-marker");

	mapComponents.map.fire('fmInteractionStart');
	mapComponents.markersLayer.lockMarker(markerId);

	async function finish(save: boolean) {
		hideToast("fm-draw-drag-marker");

		markerLayer.dragging!.disable();

		if(save) {
			try {
				const pos = markerLayer.getLatLng();
				await client.editMarker({ id: markerId, lat: pos.lat, lon: pos.lng });
			} catch (err) {
				showErrorToast("fm-draw-drag-marker", "Error moving marker", err);
			}
		}

		mapComponents.markersLayer.unlockMarker(markerId);
		mapComponents.map.fire('fmInteractionEnd');
	}

	showToast("fm-draw-drag-marker", "Drag marker", "Drag the marker to reposition it.", {
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

export async function drawLine(type: Type, client: Client, mapComponents: MapComponents): Promise<void> {
	try {
		hideToast("fm-draw-add-line");

		const lineTemplate = await client.getLineTemplate({ typeId: type.id });

		showToast("fm-draw-add-line", `Add ${type.name}`, "Click on the map to draw a line. Click “Finish” to save it.", {
			actions: [
				{ label: "Finish", onClick: () => {
					mapComponents.linesLayer.endDrawLine(true);
				}},
				{ label: "Cancel", onClick: () => {
					mapComponents.linesLayer.endDrawLine(false);
				} }
			]
		});

		const routePoints = await mapComponents.linesLayer.drawLine(lineTemplate);

		hideToast("fm-draw-add-line");

		if (routePoints) {
			const line = await client.addLine({ typeId: type.id, routePoints });
			mapComponents.selectionHandler.setSelectedItems([{ type: "line", id: line.id }], true);

			if (!mapComponents.map.fmFilterFunc(line, client.types[line.typeId]))
				showToast(getUniqueId("fm-draw-add-line"), `${type.name} successfully added`, "The line was successfully added, but the active filter is preventing it from being shown.", { variant: "success", noCloseButton: false });
		}
	} catch (err) {
		showErrorToast("fm-draw-add-line", "Error adding line", err);
	}
}