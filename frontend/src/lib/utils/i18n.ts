/// <reference types="vite/client" />
import { type i18n } from "i18next";
import { defineComponent, ref, type Directive } from "vue";
import messagesEn from "../../i18n/en.json";
import messagesDe from "../../i18n/de.json";
import messagesNbNo from "../../i18n/nb-NO.json";
import messagesRu from "../../i18n/ru.json";
import { LANG_COOKIE, LANG_QUERY, decodeQueryString, getAcceptHotI18n, getRawI18n, onI18nReady, setCurrentUnitsGetter } from "facilmap-utils";
import { cookies } from "./cookies";
import { unitsValidator } from "facilmap-types";

const namespace = "facilmap-frontend";

onI18nReady((i18n) => {
	i18n.addResourceBundle("en", namespace, messagesEn);
	i18n.addResourceBundle("de", namespace, messagesDe);
	i18n.addResourceBundle("nb-NO", namespace, messagesNbNo);
	i18n.addResourceBundle("ru", namespace, messagesRu);
});

if (import.meta.hot) {
	import.meta.hot!.accept(`../../i18n/en.json`, getAcceptHotI18n("en", namespace));
	import.meta.hot!.accept(`../../i18n/de.json`, getAcceptHotI18n("de", namespace));
	import.meta.hot!.accept(`../../i18n/nb-NO.json`, getAcceptHotI18n("nb-NO", namespace));
	import.meta.hot!.accept(`../../i18n/ru.json`, getAcceptHotI18n("ru", namespace));
}

export const i18nResourceChangeCounter = ref(0);
const onI18nResourceChange = () => {
	i18nResourceChangeCounter.value++;
};

onI18nReady((i18n) => {
	i18n.store.on("added", onI18nResourceChange);
	i18n.store.on("removed", onI18nResourceChange);
	i18n.on("languageChanged", onI18nResourceChange);
	i18n.on("loaded", onI18nResourceChange);

	let tBkp = i18n.t;
	i18n.t = function(this: any, ...args: any) {
		// Consume resource change counter to make calls to t() reactive to i18n resource changes
		i18nResourceChangeCounter.value;

		return tBkp.apply(this, args);
	} as any;
});

const UNITS_COOKIE = "units";
const UNITS_QUERY = "units";

setCurrentUnitsGetter(() => {
	const queryParams = decodeQueryString(location.search);
	const query = queryParams.format ? unitsValidator.safeParse(queryParams[UNITS_QUERY]) : undefined;
	return query?.success ? query.data : cookies[UNITS_COOKIE];
});

export function getI18n(): {
	t: i18n["t"];
	changeLanguage: (lang: string) => Promise<void>;
} {
	return {
		t: getRawI18n().getFixedT(null, namespace),

		changeLanguage: async (lang) => {
			await getRawI18n().changeLanguage(lang);
		}
	};
}

export function useI18n(): ReturnType<typeof getI18n> {
	return getI18n();
}

/**
 * Renders a translated message. Each interpolation variable needs to be specified as a slot, making it possible to interpolate
 * components and rich text.
 */
export const T = defineComponent({
	props: {
		k: { type: String, required: true }
	},
	setup(props, { slots }) {
		const i18n = useI18n();

		return () => {
			const mappedSlots = Object.entries(slots).map(([name, slot], i) => ({ name, placeholder: `%___SLOT_${i}___%`, slot }));
			const placeholderByName = Object.fromEntries(mappedSlots.map(({ name, placeholder }) => [name, placeholder]));
			const slotByPlaceholder = Object.fromEntries(mappedSlots.map(({ placeholder, slot }) => [placeholder, slot]));
			const message = i18n.t(props.k, placeholderByName);
			return message.split(/(%___SLOT_\d+___%)/g).map((v, i) => {
				if (i % 2 === 0) {
					return v;
				} else {
					return slotByPlaceholder[v]!();
				}
			});
		};
	}
});

/**
 * Replaces all descendent links of the element that match the given URLs with the given link configuration. This allows
 * replacing links in translation texts using markdown with custom functionality (such as opening a dialog).
 */
export const vReplaceLinks: Directive<HTMLElement, Record<string, { onClick: (e: Event) => void }>> = (el, binding) => {
	for (const link of el.querySelectorAll("a[href]")) {
		const href = link.getAttribute("href");
		if (binding.value[href!]) {
			link.setAttribute("href", "javascript:");
			link.removeAttribute("target");

			link.addEventListener("click", (e) => {
				e.preventDefault();

				binding.value[href!].onClick(e);
			});
		}
	}
};

export function isLanguageExplicit(): boolean {
	const queryParams = decodeQueryString(location.search);
	return !!queryParams[LANG_QUERY] || !!queryParams[LANG_COOKIE];
}

export function isUnitsExplicit(): boolean {
	const queryParams = decodeQueryString(location.search);
	return !!queryParams[UNITS_QUERY] || !!queryParams[UNITS_COOKIE];
}