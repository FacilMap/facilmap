import { decodeQueryString, encodeQueryString } from "facilmap-utils";
import Vue from "vue";

const queryParams = decodeQueryString(location.search);
const toBoolean = (val: string, def: boolean) => (val == null ? def : val != "0" && val != "false" && val != "no");

const isNarrow = () => window.innerWidth < 768;

const context = Vue.observable({
    activePadId: decodeURIComponent(location.pathname.match(/[^/]*$/)![0]),
    urlPrefix: location.protocol + "//" + location.host + location.pathname.replace(/[^/]*$/, ""),
    toolbox: toBoolean(queryParams.toolbox, true),
    search: toBoolean(queryParams.search, true),
    autofocus: toBoolean(queryParams.autofocus, parent === window),
    legend: toBoolean(queryParams.legend, true),
    interactive: toBoolean(queryParams.interactive, parent === window),
    isNarrow: isNarrow(),
    isInFrame: parent !== window
});

window.addEventListener("resize", () => {
    context.isNarrow = isNarrow();
});

export default context;

if(!location.hash || location.hash == "#") {
    const moveKeys = Object.keys(queryParams).filter((key) => ([ "zoom", "lat", "lon", "layer", "l", "q", "s", "c" ].includes(key)));
    if(moveKeys.length > 0) {
        const hashParams: Record<string, string> = { };
        for (const key of moveKeys) {
            hashParams[key] = queryParams[key];
            delete queryParams[key];
        }

        const query = encodeQueryString(queryParams);
        const hash = encodeQueryString(hashParams);

        history.replaceState(null, "", context.urlPrefix + (context.activePadId || "") + (query ? "?" + query : "") + "#" + hash);
    }
}

export function updatePadId(padId: string): void {
    context.activePadId = padId;
 
    if (padId)
        history.replaceState(null, "", context.urlPrefix + padId + location.search + location.hash);
}

export function updatePadName(padName: string): void {
    const title = padName ? padName + ' – FacilMap' : 'FacilMap';

    // We have to call history.replaceState() in order for the new title to end up in the browser history
    window.history && history.replaceState({ }, title);
    document.title = title;
}