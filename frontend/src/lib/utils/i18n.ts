/// <reference types="vite/client" />
import { type i18n } from "i18next";
import { defineComponent, h, ref, type Directive } from "vue";
import { LANG_COOKIE, LANG_QUERY, decodeQueryString, getCurrentLanguage, getRawI18n, onI18nReady, quoteRegExp, setCurrentUnitsGetter } from "facilmap-utils";
import { cookies } from "./cookies";
import { unitsValidator } from "facilmap-types";

const namespace = "facilmap-frontend";

onI18nReady((i18n) => {
	for (const [filename, module] of Object.entries(import.meta.glob('../../i18n/*.json', { eager: true }))) {
		const lang = filename.match(/([^/\\]*)\.json$/i)![1];

		// This does not seem to work, need to find a different solution
		// if (import.meta.hot) {
		// 	import.meta.hot!.accept(filename, getAcceptHotI18n(lang, namespace));
		// }

		i18n.addResourceBundle(lang, namespace, (module as any).default);
	}
});

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
	const query = queryParams[UNITS_QUERY] ? unitsValidator.safeParse(queryParams[UNITS_QUERY]) : undefined;
	return query?.success ? query.data : cookies[UNITS_COOKIE];
});

export function getI18n(): {
	t: i18n["t"];
	changeLanguage: (lang: string) => Promise<void>;
	currentLanguage: string;
} {
	return {
		t: getRawI18n().getFixedT(null, namespace),

		changeLanguage: async (lang) => {
			await getRawI18n().changeLanguage(lang);
		},

		get currentLanguage() {
			// Consume resource change counter to make this reactive to language changes
			i18nResourceChangeCounter.value;
			return getCurrentLanguage();
		}
	};
}

export function useI18n(): ReturnType<typeof getI18n> {
	return getI18n();
}

/**
 * Outputs the given text, replacing each occurrence of each provided slot key with the contents of that slot.
 */
export const ReplacePlaceholders = defineComponent({
	props: {
		text: { type: String, required: true },
		spans: { type: Boolean }
	},
	setup(props, { slots }) {
		return () => {
			return props.text.split(new RegExp(`(${Object.keys(slots).map((slotName) => quoteRegExp(slotName)).join("|")})`, "g")).map((v, i) => {
				if (i % 2 === 1) {
					return slots[v]!();
				} else if (props.spans && v) {
					return h("span", v);
				} else {
					return v;
				}
			});
		};
	}
});

/**
 * Renders a translated message. Each interpolation variable needs to be specified as a slot, making it possible to interpolate
 * components and rich text.
 */
export const T = defineComponent({
	props: {
		k: { type: String, required: true },
		spans: { type: Boolean }
	},
	setup(props, { slots }) {
		const i18n = useI18n();

		return () => {
			const mappedSlots = Object.entries(slots).map(([name, slot], i) => ({ name, placeholder: `%___SLOT_${i}___%`, slot }));
			const placeholderByName = Object.fromEntries(mappedSlots.map(({ name, placeholder }) => [name, placeholder]));
			const slotByPlaceholder = Object.fromEntries(mappedSlots.map(({ placeholder, slot }) => [placeholder, slot]));
			const message = i18n.t(props.k, placeholderByName);
			return h(ReplacePlaceholders, {
				text: message,
				spans: props.spans
			}, slotByPlaceholder);
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
	return !!queryParams[LANG_QUERY] || !!cookies[LANG_COOKIE];
}

export function isUnitsExplicit(): boolean {
	const queryParams = decodeQueryString(location.search);
	return !!queryParams[UNITS_QUERY] || !!cookies[UNITS_COOKIE];
}