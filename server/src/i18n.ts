import { defaultRawI18nGetter, getRawI18n, onI18nReady, setLanguageDetector, setRawI18nGetter } from "facilmap-utils";
import messagesEn from "./i18n/en";
import messagesDe from "./i18n/de";
import type { i18n } from "i18next";
import type { Domain } from "domain";
import type { RequestHandler } from "express";
import i18nextHttpMiddleware from "i18next-http-middleware";

const namespace = "facilmap-server";

declare global {
    namespace NodeJS {
        interface Process {
            domain?: Domain;
        }
    }
}

declare module 'domain' {
    interface Domain {
        facilmap?: {
            i18n?: i18n
        }
    }
}

onI18nReady((i18n) => {
	i18n.addResourceBundle("en", namespace, messagesEn);
	i18n.addResourceBundle("de", namespace, messagesDe);
});

setLanguageDetector(i18nextHttpMiddleware.LanguageDetector);

export const i18nMiddleware: RequestHandler[] = [
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	(req, res, next) => {
		i18nextHttpMiddleware.handle(getRawI18n())(req, res, next);
	},

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	(req, res, next) => {
		if ((req as any).i18n) {
			if (!process.domain!.facilmap) {
				process.domain!.facilmap = {};
			}

			process.domain!.facilmap.i18n = (req as any).i18n;
		}

		next();
	}
];

setRawI18nGetter(() => {
	if (process.domain?.facilmap?.i18n) {
		return process.domain?.facilmap?.i18n;
	} else {
		return defaultRawI18nGetter();
	}
});

export function getI18n(): Pick<i18n, "t"> {
	return {
		t: getRawI18n().getFixedT(null, namespace)
	};
}