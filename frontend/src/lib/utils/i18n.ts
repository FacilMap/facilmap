/// <reference types="vite/client" />
import { type i18n } from "i18next";
import { defineComponent, ref } from "vue";
import messagesEn from "../../i18n/en";
import messagesDe from "../../i18n/de";
import { getRawI18n, onI18nReady } from "facilmap-utils";

const namespace = "facilmap-frontend";

onI18nReady((i18n) => {
	i18n.addResourceBundle("en", namespace, messagesEn);
	i18n.addResourceBundle("de", namespace, messagesDe);
});

if (import.meta.hot) {
	import.meta.hot.accept("../../i18n/en", (m) => {
		onI18nReady((i18n) => {
			i18n.addResourceBundle("en", namespace, m!.default);
		});
	});

	import.meta.hot.accept("../../i18n/de", (m) => {
		onI18nReady((i18n) => {
			i18n.addResourceBundle("de", namespace, m!.default);
		});
	});
}

const i18nResourceChangeCounter = ref(0);
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

export function useI18n(): {
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