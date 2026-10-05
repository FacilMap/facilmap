import { computed, markRaw, reactive, ref, type DeepReadonly, type Raw } from "vue";
import { getMarkerIcon, RouteLayer } from "facilmap-leaflet";
import DraggableLines from "leaflet-draggable-lines";
import { throttle } from "lodash-es";
import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
import { useMapHandler } from "../../utils/leaflet";
import LinesLayerTooltip from "facilmap-leaflet/src/lines/lines-layer-tooltip.js";
import { dragMarkerColour, makeCoordDestination, type RouteFormDestination, insertDestination, replaceDestination, removeDestination, getRouteDragIcon } from "./route-form-utils.js";
import type { RouteWithTrackPoints } from "facilmap-client";

export function useRouteFormDrag(data: Readonly<{
	destinations: DeepReadonly<RouteFormDestination[]>;
	route: DeepReadonly<RouteWithTrackPoints> | undefined;
	routeLayer: Raw<RouteLayer>;
	hoverDestinationIdx: number | undefined;
	destinationMouseOver: (idx: number) => void;
	destinationMouseOut: (idx: number) => void;
	setDestinations: (destinations: RouteFormDestination[]) => void;
	reroute: (zoom: boolean) => void;
}>): {
	hoverInsertIdx: number | undefined;
	enable: () => void;
	disable: () => void;
} {
	const context = injectContextRequired();
	const mapContext = requireMapContext(context);

	const tooltip = new LinesLayerTooltip();

	const hoverInsertIdx = ref<number>();

	const draggable = computed(() => {
		const draggable = markRaw(new DraggableLines(mapContext.value.components.map, {
			enableForLayer: false,
			tempMarkerOptions: () => ({
				icon: getMarkerIcon(`#${dragMarkerColour}`, 35),
				pane: "fm-raised-marker"
			}),
			plusTempMarkerOptions: () => ({
				icon: getMarkerIcon(`#${dragMarkerColour}`, 35),
				pane: "fm-raised-marker"
			}),
			dragMarkerOptions: (layer, i, length) => ({
				icon: getRouteDragIcon(i, length),
				pane: "fm-raised-marker"
			})
		}));

		draggable.on({
			insert: (e) => {
				data.setDestinations(insertDestination(data.destinations, makeCoordDestination(e.latlng), e.idx as number));
				void data.reroute(false);
			},
			dragstart: (e) => {
				data.destinationMouseOver(e.idx as number);
				hoverInsertIdx.value = undefined;
				if (e.isNew) {
					data.setDestinations(insertDestination(data.destinations, makeCoordDestination(e.to), e.idx as number));
				}
			},
			drag: throttle((e) => {
				data.setDestinations(replaceDestination(data.destinations, makeCoordDestination(e.to), e.idx));
			}, 300),
			dragend: (e) => {
				data.setDestinations(replaceDestination(data.destinations, makeCoordDestination(e.to), e.idx as number));
				void data.reroute(false);
			},
			remove: (e) => {
				data.destinationMouseOut(e.idx as number);
				data.setDestinations(removeDestination(data.destinations, e.idx as number));
				void data.reroute(false);
			},
			dragmouseover: (e) => {
				data.destinationMouseOver(e.idx as number);
			},
			dragmouseout: (e) => {
				data.destinationMouseOut(e.idx as number);
			},
			plusmouseover: (e) => {
				hoverInsertIdx.value = e.idx as number;
			},
			plusmouseout: (e) => {
				hoverInsertIdx.value = undefined;
			},
			tempmouseover: (e) => {
				hoverInsertIdx.value = e.idx as number;

				tooltip.registerLineTooltip(e.marker, {
					getLine: () => data.route && { ...data.route, extraInfo: data.route.extraInfo ?? null, name: "" },
					getLineString: () => data.routeLayer._fmLineString,
					getOptions: () => ({ name: false, details: true }),
					getHoverPos: () => data.routeLayer._fmLineString?.locate(e.marker.getLatLng()),
					fixed: true
				});
			},
			tempmousemove: (e) => {
				if (e.idx != hoverInsertIdx.value) {
					hoverInsertIdx.value = e.idx as number;
				}

				tooltip.updateLineTooltip(e.marker);
			},
			tempmouseout: (e) => {
				hoverInsertIdx.value = undefined;
			}
		});

		return draggable;
	});

	useMapHandler(draggable);

	return reactive({
		hoverInsertIdx,
		enable: () => {
			draggable.value.enableForLayer(data.routeLayer);
		},
		disable: () => {
			draggable.value.disableForLayer(data.routeLayer);
		}
	});
}