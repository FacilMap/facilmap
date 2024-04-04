import i18next, { type CustomPluginOptions, type Module, type Newable, type i18n } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";

export const LANGUAGES = {
	en: "English",
	de: "Deutsch"
};

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
			supportedLngs: Object.keys(LANGUAGES),
			...(languageDetector ? {} : { lng: DEFAULT_LANGUAGE }),
			fallbackLng: DEFAULT_LANGUAGE,
			detection: languageDetectorOptions
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

// Should be called by an individual getI18n() function in each package that makes sure that its translations are loaded
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

export function getCurrentLanguage(): string {
	return getRawI18n().language;
}