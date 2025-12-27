/// <reference types="vite/client" />
import type { i18n } from "i18next";
import { getRawI18n, onI18nReady } from "facilmap-utils";

const namespace = "facilmap-leaflet";

onI18nReady((i18n) => {
	for (const [filename, module] of Object.entries(import.meta.glob('../i18n/*.json', { eager: true }))) {
		const lang = filename.match(/([^/\\]*)\.json$/i)![1];

		// This does not seem to work, need to find a different solution
		// if (import.meta.hot) {
		// 	import.meta.hot!.accept(filename, getAcceptHotI18n(lang, namespace));
		// }

		i18n.addResourceBundle(lang, namespace, (module as any).default);
	}
});

export function getI18n(): Pick<i18n, "t"> {
	return {
		t: getRawI18n().getFixedT(null, namespace)
	};
}
