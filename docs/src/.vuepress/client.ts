import { defineClientConfig } from '@vuepress/client';
import QrcodeVue from 'qrcode.vue';
import Screencast from "./components/Screencast.vue";
import Screenshot from "./components/Screenshot.vue";

export default defineClientConfig({
	enhance({ app, router, siteData }) {
		app.component("qrcode", QrcodeVue);
		app.component("Screencast", Screencast);
		app.component("Screenshot", Screenshot);

		app.config.globalProperties.$resolveLink

		router.addRoute({ path: '/users/hash/', redirect: '/users/share/' });
	}
});
