import { createApp, defineComponent, h, ref, watch } from "vue";
import { FacilMap } from "../lib";
import { decodeQueryString, encodeQueryString, normalizePadName } from "facilmap-utils";
import decodeURIComponent from "decode-uri-component";
import "../lib/bootstrap.scss"; // Not imported in lib/index.ts because we don't want it to be bundled
import { setLayerOptions } from "facilmap-leaflet";
import config from "./config";
import { registerDereferrerHandler } from "../utils/dereferrer";

if (import.meta.hot) {
	// Prevent full reload, see https://github.com/vitejs/vite/issues/5763#issuecomment-1974235806
	import.meta.hot.on('vite:beforeFullReload', (payload) => {
		payload.path = "(WORKAROUND).html";
	});
}

registerDereferrerHandler();

if ('serviceWorker' in navigator && location.hostname !== "localhost")
	navigator.serviceWorker.register('./_app/static/sw.js', { scope: "./" });

setLayerOptions({
	limaLabsToken: config.limaLabsToken
});

const queryParams = decodeQueryString(location.search);
const toBoolean = (val: string, def: boolean) => (val == null ? def : val != "0" && val != "false" && val != "no");

const baseUrl = location.protocol + "//" + location.host + location.pathname.replace(/[^/]*$/, "");
const initialPadId = decodeURIComponent(location.pathname.match(/[^/]*$/)![0]) || undefined;

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

		history.replaceState(null, "", baseUrl + encodeURIComponent(initialPadId || "") + (query ? "?" + query : "") + "#" + hash);
	}
}

const Root = defineComponent({
	setup() {
		const padId = ref(initialPadId);
		const padName = ref<string | undefined>(undefined);

		watch(padId, () => {
			history.replaceState(null, "", baseUrl + (padId.value ? encodeURIComponent(padId.value) : "") + location.search + location.hash);
		});

		watch(padName, () => {
			const title = padName.value != null ? `${normalizePadName(padName.value)} – ${config.appName}` : config.appName;

			// We have to call history.replaceState() in order for the new title to end up in the browser history
			window.history && history.replaceState({ }, title);
			document.title = title;
		});

		return () => h(FacilMap, {
			baseUrl,
			serverUrl: baseUrl,
			padId: padId.value,
			appName: config.appName,
			hideCommercialMapLinks: config.hideCommercialMapLinks,
			settings: {
				toolbox: toBoolean(queryParams.toolbox, true),
				search: toBoolean(queryParams.search, true),
				autofocus: toBoolean(queryParams.autofocus, parent === window),
				legend: toBoolean(queryParams.legend, true),
				interactive: toBoolean(queryParams.interactive, parent === window),
				linkLogo: parent !== window,
				updateHash: true
			},
			"onUpdate:padId": (v) => padId.value = v,
			"onUpdate:padName": (v) => padName.value = v
		});
	}
});

createApp(Root)
	.mount(document.getElementById("app")!);

document.getElementById("loading")!.remove();