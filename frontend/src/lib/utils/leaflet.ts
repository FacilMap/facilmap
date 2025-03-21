import type { Handler, Layer } from "leaflet";
import { toRef, watch } from "vue";
import { useIsMounted } from "./vue";
import { injectContextRequired, requireMapContext } from "../components/facil-map-context-provider/facil-map-context-provider.vue";
import type { AnyRef } from "./utils";

export function useMapLayer(layerRef: AnyRef<Layer>): void {
	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const isMounted = useIsMounted();
	watch([isMounted, toRef(layerRef), () => mapContext.value.components.map], (v, o, onCleanup) => {
		if (isMounted.value) {
			v[1].addTo(mapContext.value.components.map);

			onCleanup(() => {
				v[1].remove();
			});
		}
	}, { immediate: true });
}

export function useMapHandler(handlerRef: AnyRef<Handler>): void {
	const isMounted = useIsMounted();
	watch([isMounted, toRef(handlerRef)], (v, o, onCleanup) => {
		if (isMounted.value) {
			v[1].enable();

			onCleanup(() => {
				v[1].disable();
			});
		}
	}, { immediate: true });
}