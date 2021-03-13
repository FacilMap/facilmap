import { VueDecorator } from "vue-class-component";
import { InjectReactive } from "vue-property-decorator";

export const CLIENT_INJECT_KEY = "fm-client";
export const MAP_COMPONENTS_INJECT_KEY = "fm-map-components";
export const MAP_CONTEXT_INJECT_KEY = "fm-map-context";

export function InjectMapComponents(): VueDecorator {
    return InjectReactive(MAP_COMPONENTS_INJECT_KEY);
}

export function InjectMapContext(): VueDecorator {
    return InjectReactive(MAP_CONTEXT_INJECT_KEY);
}

export function InjectClient(): VueDecorator {
    return InjectReactive(CLIENT_INJECT_KEY);
}