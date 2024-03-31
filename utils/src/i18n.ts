/// <reference types="vite/client" />
import type { i18n } from "i18next";
import { getRawI18n, onI18nReady } from "./i18n-utils";
import messagesDe from "./i18n/de";
import messagesEn from "./i18n/en";

const namespace = "facilmap-utils";

onI18nReady((i18n) => {
	i18n.addResourceBundle("en", namespace, messagesEn);
	i18n.addResourceBundle("de", namespace, messagesDe);
});

if (import.meta.hot) {
	import.meta.hot.accept("./i18n/en", (m) => {
		onI18nReady((i18n) => {
			i18n.addResourceBundle("en", namespace, m!.default);
		});
	});

	import.meta.hot.accept("./i18n/de", (m) => {
		onI18nReady((i18n) => {
			i18n.addResourceBundle("de", namespace, m!.default);
		});
	});
}

export function getI18n(): Pick<i18n, "t"> {
	return {
		t: getRawI18n().getFixedT(null, namespace)
	};
}