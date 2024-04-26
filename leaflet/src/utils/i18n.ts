/// <reference types="vite/client" />
import type { i18n } from "i18next";
import messagesDe from "../i18n/de.json";
import messagesEn from "../i18n/en.json";
import messagesEs from "../i18n/es.json";
import messagesNbNo from "../i18n/nb-NO.json";
import messagesRu from "../i18n/ru.json";
import { getAcceptHotI18n, getRawI18n, onI18nReady } from "facilmap-utils";

const namespace = "facilmap-leaflet";

onI18nReady((i18n) => {
	i18n.addResourceBundle("en", namespace, messagesEn);
	i18n.addResourceBundle("de", namespace, messagesDe);
	i18n.addResourceBundle("es", namespace, messagesEs);
	i18n.addResourceBundle("nb-NO", namespace, messagesNbNo);
	i18n.addResourceBundle("ru", namespace, messagesRu);
});

if (import.meta.hot) {
	if (import.meta.hot) {
		import.meta.hot!.accept(`../i18n/en.json`, getAcceptHotI18n("en", namespace));
		import.meta.hot!.accept(`../i18n/de.json`, getAcceptHotI18n("de", namespace));
		import.meta.hot!.accept(`../i18n/es.json`, getAcceptHotI18n("es", namespace));
		import.meta.hot!.accept(`../i18n/nb-NO.json`, getAcceptHotI18n("nb-NO", namespace));
		import.meta.hot!.accept(`../i18n/ru.json`, getAcceptHotI18n("ru", namespace));
	}
}

export function getI18n(): Pick<i18n, "t"> {
	return {
		t: getRawI18n().getFixedT(null, namespace)
	};
}
