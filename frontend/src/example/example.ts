import Vue from "vue";
import { BootstrapVue } from "bootstrap-vue";
import "bootstrap/dist/css/bootstrap.css";
import "bootstrap-vue/dist/bootstrap-vue.css";
import withRender from "./example.vue";
import { FacilMap } from "../lib";
import MapControl from "./map-control";

Vue.use(BootstrapVue);

new Vue(withRender({
	el: "#app",
	data: {
		serverUrl: "http://localhost:40829/",
		padId1: "test",
		padName1: undefined,
		padId2: "test",
		padName2: undefined
	},
	components: { FacilMap, MapControl }
}));
