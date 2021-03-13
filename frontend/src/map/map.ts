import $ from 'jquery';
import Vue from "vue";
import { BootstrapVue } from "bootstrap-vue";
import { registerDeobfuscationHandlers } from "../utils/ui";
import Main from './main/main';
import { ClientProvider } from './client/client';
import context, { updatePadId, updatePadName } from './context';
import "bootstrap/dist/css/bootstrap.css";
import "bootstrap-vue/dist/bootstrap-vue.css";
import withRender from "./map.vue";
import PortalVue from "portal-vue";
import "../utils/validation";
import { PadId } from 'facilmap-types';

Vue.use(BootstrapVue);
Vue.use(PortalVue);

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

registerDeobfuscationHandlers();

new Vue(withRender({
	el: "#loading",
	data: {
		serverUrl: "/",
		padId: context.activePadId
	},
	methods: {
		handlePadIdChange(padId: PadId) {
			updatePadId(padId);
		},

		handlePadNameChange(padName: string) {
			updatePadName(padName);
		}
	},
	components: { ClientProvider, Main }
}));
