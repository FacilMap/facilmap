import { Units } from "facilmap-types";
import i18next, { type CustomPluginOptions, type Module, type Newable, type i18n } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import languageNames from "virtual:languages";

export const LANGUAGES = Object.keys(languageNames);

export const DEFAULT_LANGUAGE = "en";

export const LANG_COOKIE = "lang";
export const LANG_QUERY = "lang";

let hasBeenUsed = false;
const onFirstUse: Array<(i18n: i18n) => void> = [];

let languageDetector: Module | Newable<Module> | undefined = typeof window !== "undefined" ? LanguageDetector : undefined;
let languageDetectorOptions: CustomPluginOptions["detection"] = typeof window !== "undefined" ? {
	order: ['querystring', 'cookie', 'navigator'],
	lookupQuerystring: LANG_QUERY,
	lookupCookie: LANG_COOKIE,
	caches: []
} : undefined;
export let isCustomLanguageDetector = false;

export function setLanguageDetector(detector: Module | Newable<Module> | undefined, options?: CustomPluginOptions["detection"]): void {
	languageDetector = detector;
	languageDetectorOptions = options;
	isCustomLanguageDetector = true;
}

export const defaultI18nGetter = (): i18n => {
	// Initialize i18next on first usage if it is not initialized yet.
	// In apps that use i18next, this leaves enough time for them to initialize it with their own custom settings.
	// In apps that don't use i18next, this allows them to use our functions without having to care about initializing it.
	if (!i18next.isInitializing && !i18next.isInitialized) {
		if (languageDetector) {
			i18next.use(languageDetector);
		}

		void i18next.init({
			initImmediate: false,
			supportedLngs: LANGUAGES,
			...(languageDetector ? {} : { lng: DEFAULT_LANGUAGE }),
			fallbackLng: DEFAULT_LANGUAGE,
			detection: languageDetectorOptions,
			interpolation: { escapeValue: false }
		});
	}

	return i18next;
};

let i18nGetter = defaultI18nGetter;
export let isCustomI18nGetter = false;

export function setI18nGetter(getter: () => i18n): void {
	i18nGetter = getter;
	isCustomI18nGetter = true;
}

/**
 * Returns the i18n object returned by the i18nGetter, with any onI18nReady() callbacks applied.
 * This should not be called by translated components directly. Instead, each package should provide its own wrapper for this function
 * in a module that loads the necessary i18n resources as a side effect.
 */
export function getRawI18n(): i18n {
	const i18n = i18nGetter();

	if (!hasBeenUsed) {
		for (const callback of onFirstUse) {
			callback(i18n);
		}
		hasBeenUsed = true;
	}

	return i18n;
}

/**
 * Calls the given callback the first time getI18n() is called. If getI18n() has already been called, calls the callback immediately.
 */
export function onI18nReady(callback: (i18n: i18n) => void): void {
	if (hasBeenUsed) {
		callback(getRawI18n());
	} else {
		onFirstUse.push(callback);
	}
}

export function getAcceptHotI18n(lang: string, namespace: string): (mod: any) => void {
	return (mod: any) => {
		if (mod) {
			onI18nReady((i18n) => {
				i18n.addResourceBundle(lang, namespace, mod!.default);
			});
		}
	};
}

export function getCurrentLanguage(): string {
	return getRawI18n().language;
}


let currentUnitsGetter: (() => Units | undefined) | undefined;

export function setCurrentUnitsGetter(getter: typeof currentUnitsGetter): void {
	currentUnitsGetter = getter;
}

export function getCurrentUnits(): Units {
	return currentUnitsGetter?.() ?? Units.METRIC;
}