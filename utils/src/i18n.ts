/// <reference types="vite/client" />
import type { i18n } from "i18next";
import { getAcceptHotI18n, getRawI18n, onI18nReady } from "./i18n-utils";
import messagesDe from "./i18n/de.json";
import messagesEn from "./i18n/en.json";
import messagesEs from "./i18n/es.json";
import messagesNbNo from "./i18n/nb-NO.json";
import messagesRu from "./i18n/ru.json";
import messagesZhHant from "./i18n/zh-Hant.json";

const namespace = "facilmap-utils";

onI18nReady((i18n) => {
	i18n.addResourceBundle("en", namespace, messagesEn);
	i18n.addResourceBundle("de", namespace, messagesDe);
	i18n.addResourceBundle("es", namespace, messagesEs);
	i18n.addResourceBundle("nb-NO", namespace, messagesNbNo);
	i18n.addResourceBundle("ru", namespace, messagesRu);
	i18n.addResourceBundle("zh-Hant", namespace, messagesZhHant);
});

if (import.meta.hot) {
	if (import.meta.hot) {
		import.meta.hot!.accept(`./i18n/en.json`, getAcceptHotI18n("en", namespace));
		import.meta.hot!.accept(`./i18n/de.json`, getAcceptHotI18n("de", namespace));
		import.meta.hot!.accept(`./i18n/es.json`, getAcceptHotI18n("es", namespace));
		import.meta.hot!.accept(`./i18n/nb-NO.json`, getAcceptHotI18n("nb-NO", namespace));
		import.meta.hot!.accept(`./i18n/ru.json`, getAcceptHotI18n("ru", namespace));
		import.meta.hot!.accept(`./i18n/zh-Hant.json`, getAcceptHotI18n("zh-Hant", namespace));
	}
}

export function getI18n(): Pick<i18n, "t"> {
	return {
		t: getRawI18n().getFixedT(null, namespace)
	};
}

/**
 * Returns a map of each existing language key to its language name in the language itself.
 */
export function getLocalizedLanguageList(): Record<string, string> {
	return {
		"en": getI18n().t("i18n.language-en", { lng: "en" }),
		"de": getI18n().t("i18n.language-de", { lng: "de" }),
		"es": getI18n().t("i18n.language-es", { lng: "es" }),
		"nb-NO": getI18n().t("i18n.language-nb-no", { lng: "nb-NO" }),
		"ru": getI18n().t("i18n.language-ru", { lng: "ru" }),
		"zh-Hant": getI18n().t("i18n.language-zh-hant", { lng: "zh-Hant" })
	};
};