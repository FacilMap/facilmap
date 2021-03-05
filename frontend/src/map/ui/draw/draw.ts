import Client from "facilmap-client";
import { addClickListener } from "facilmap-leaflet";
import { Type } from "facilmap-types";
import { MapComponents } from "../../leaflet-map/leaflet-map";
import toastActions from "../toast-actions/toast-actions";

export function drawMarker(type: Type, component: Vue, client: Client, mapComponents: MapComponents): void {
	const clickListener = addClickListener(mapComponents.map, async (point) => {
		component.$bvToast.hide("fm-toolbox-add-marker");

		try {
			await client.addMarker({
				lat: point.lat,
				lon: point.lon,
				typeId: type.id
			});
		} catch (err) {
			console.error(err.stack || err);

			component.$bvToast.toast(err.message || err, {
				id: "fm-toolbox-add-marker",
				title: "Error adding marker",
				variant: "danger",
				noAutoHide: true
			});
		}
	});

	component.$bvToast.toast(toastActions(component, "Please click on the map to add a marker.", [
		{ label: "Cancel", onClick: () => {
			component.$bvToast.hide("fm-toolbox-add-marker");
			clickListener.cancel();
		} }
	]), {
		id: "fm-toolbox-add-marker",
		title: `Add ${type.name}`,
		noCloseButton: true,
		noAutoHide: true
	});
}

export async function drawLine(type: Type, component: Vue, client: Client, mapComponents: MapComponents): Promise<void> {
	try {
		component.$bvToast.hide("fm-toolbox-add-line");

		const lineTemplate = await client.getLineTemplate({ typeId: type.id });

		console.log(lineTemplate);

		component.$bvToast.toast(toastActions(component, "Please click on the map to draw a line. Double-click to finish it.", [
			{ label: "Finish", onClick: () => {
				mapComponents.linesLayer.endDrawLine(true);
			}},
			{ label: "Cancel", onClick: () => {
				mapComponents.linesLayer.endDrawLine(false);
			} }
		]), {
			id: "fm-toolbox-add-line",
			title: `Add ${type.name}`,
			noCloseButton: true,
			noAutoHide: true
		});

		const routePoints = await mapComponents.linesLayer.drawLine(lineTemplate);

		component.$bvToast.hide("fm-toolbox-add-line");

		if (routePoints) {
			await client.addLine({ typeId: type.id, routePoints });
		}
	} catch (err) {
		component.$bvToast.toast(err.message || err, {
			id: "fm-toolbox-add-line",
			title: "Error adding line",
			variant: "danger",
			noAutoHide: true
		});
	}
}