import i18next, { type Module, type Newable, type i18n } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";

let hasBeenUsed = false;
const onFirstUse: Array<(i18n: i18n) => void> = [];

let languageDetector: Module | Newable<Module> | undefined = typeof window !== "undefined" ? LanguageDetector : undefined;

export function setLanguageDetector(detector: Module | Newable<Module> | undefined): void {
	languageDetector = detector;
}

export const defaultRawI18nGetter = (): i18n => {
	// Initialize i18next on first usage if it is not initialized yet.
	// In apps that use i18next, this leaves enough time for them to initialize it with their own custom settings.
	// In apps that don't use i18next, this allows them to use our functions without having to care about initializing it.
	if (!i18next.isInitializing && !i18next.isInitialized) {
		if (languageDetector) {
			i18next.use(languageDetector);
		}

		void i18next.init({
			initImmediate: false,
			...(languageDetector ? {} : { lng: "en" }),
			fallbackLng: "en"
		});
	}

	return i18next;
};

let rawI18nGetter = defaultRawI18nGetter;

export function setRawI18nGetter(getter: () => i18n): void {
	rawI18nGetter = getter;
}

// Should be called by an individual getI18n() function in each package that makes sure that its translations are loaded
export function getRawI18n(): i18n {
	const i18n = rawI18nGetter();

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
