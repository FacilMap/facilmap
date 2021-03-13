import Vue from "vue";
import { Field, RouteMode } from "facilmap-types";
import { formatField, formatRouteMode, formatTime, round } from "facilmap-utils";

Vue.directive("fm-scroll-into-view", {
	inserted(el, binding) {
		if (binding.value)
			el.scrollIntoView({ behavior: "smooth", block: "nearest" });
	},

	update(el, binding) {
		if (binding.value && !binding.oldValue)
			el.scrollIntoView({ behavior: "smooth", block: "nearest" })
	}
});

Vue.filter('round', (number: number, digits: number) => round(number, digits));

Vue.filter('fmFieldContent', (value: string, field: Field) => formatField(field, value));

Vue.filter('fmFormatTime', (value: number) => formatTime(value));

Vue.filter('fmRouteMode', (value: RouteMode) => formatRouteMode(value));