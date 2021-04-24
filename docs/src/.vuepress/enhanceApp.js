import NavLink from '@theme/components/NavLink.vue'

if (typeof window !== "undefined")
	window.global = window;

const qrcode = require("vue-qrcode").default;

export default ({ Vue, options, router, siteData }) => {
	Vue.component("qrcode", qrcode);
	Vue.component("NavLink", NavLink);
};
