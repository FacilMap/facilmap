import $ from 'jquery';
import Vue from "vue";
import { BootstrapVue } from "bootstrap-vue";
import { FacilMap } from "../lib";
import "./bootstrap.scss";
import "bootstrap-vue/dist/bootstrap-vue.css";
import withRender from "./map.vue";
import "./map.scss";
import { decodeQueryString, encodeQueryString } from "facilmap-utils";
import decodeURIComponent from "decode-uri-component";

Vue.use(BootstrapVue, {
	BDropdown: {
		popperOpts: {
			positionFixed: true,
			/* modifiers: {
				preventOverflow: {
					enabled: false
				},
				hide: {
					enabled: false
				}
			} */
		},
		boundary: "window",
		noFlip: true
	},
	BTooltip: {
		popperOpts: { positionFixed: true },
		boundary: "window"
	}
});

// Dereferrer
$(document).on("click", "a", function() {
	const el = $(this);
	const href = el.attr("href");
	if(href && href.match(/^\s*(https?:)?\/\//i)) {
		el.attr("href", "deref.html?"+encodeURIComponent(href));

		setTimeout(function() {
			el.attr("href", href);
		}, 0);
	}
});

if ('serviceWorker' in navigator)
	navigator.serviceWorker.register('./sw.js');

const queryParams = decodeQueryString(location.search);
const toBoolean = (val: string, def: boolean) => (val == null ? def : val != "0" && val != "false" && val != "no");

const baseUrl = location.protocol + "//" + location.host + location.pathname.replace(/[^/]*$/, "");
const initialPadId = decodeURIComponent(location.pathname.match(/[^/]*$/)![0]);

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

new Vue(withRender({
	el: "#loading",
	data: {
		padId: initialPadId,
		padName: undefined,
		baseUrl,
		toolbox: toBoolean(queryParams.toolbox, true),
		search: toBoolean(queryParams.search, true),
		autofocus: toBoolean(queryParams.autofocus, parent === window),
		legend: toBoolean(queryParams.legend, true),
		interactive: toBoolean(queryParams.interactive, parent === window),
		linkLogo: parent !== window
	},
	watch: {
		padId: (padId: string | undefined) => {
			history.replaceState(null, "", baseUrl + (padId ? encodeURIComponent(padId) : "") + location.search + location.hash);
		},
		padName: (padName: string | undefined) => {
			const title = padName ? padName + ' – FacilMap' : 'FacilMap';

			// We have to call history.replaceState() in order for the new title to end up in the browser history
			window.history && history.replaceState({ }, title);
			document.title = title;
		}
	},
	components: { FacilMap }
}));
