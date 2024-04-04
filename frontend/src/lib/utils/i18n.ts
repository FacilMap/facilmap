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

const rerenderCounter = ref(0);
const rerender = () => {
	rerenderCounter.value++;
};

onI18nReady((i18n) => {
	i18n.store.on("added", rerender);
	i18n.store.on("removed", rerender);
	i18n.on("languageChanged", rerender);
	i18n.on("loaded", rerender);
});

export function useI18n(): {
	t: i18n["t"];
	changeLanguage: (lang: string) => Promise<void>;
} {
	return {
		t: new Proxy(getRawI18n().getFixedT(null, namespace), {
			apply: (target, thisArg, argumentsList) => {
				rerenderCounter.value;
				return target.apply(thisArg, argumentsList as any);
			}
		}),

		changeLanguage: async (lang) => {
			await getRawI18n().changeLanguage(lang);
		}
	};
}

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