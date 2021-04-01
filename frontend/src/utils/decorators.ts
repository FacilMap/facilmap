import { VueDecorator } from "vue-class-component";
import { InjectReactive } from "vue-property-decorator";
import FmClient from "facilmap-client";
import StringMap from "./string-map";

export const CLIENT_INJECT_KEY = "fm-client";
export const MAP_COMPONENTS_INJECT_KEY = "fm-map-components";
export const MAP_CONTEXT_INJECT_KEY = "fm-map-context";
export const SEARCH_BOX_CONTEXT_INJECT_KEY = "fm-search-box-context";

export function InjectMapComponents(): VueDecorator {
    return InjectReactive(MAP_COMPONENTS_INJECT_KEY);
}

export function InjectMapContext(): VueDecorator {
    return InjectReactive(MAP_CONTEXT_INJECT_KEY);
}

export type Client = FmClient<StringMap>;

export function InjectClient(): VueDecorator {
    return InjectReactive(CLIENT_INJECT_KEY);
}

export function InjectSearchBoxContext(): VueDecorator {
    return InjectReactive(SEARCH_BOX_CONTEXT_INJECT_KEY);
}