import { defaultI18nGetter, getRawI18n, onI18nReady, setLanguageDetector, setI18nGetter, isCustomLanguageDetector, isCustomI18nGetter, LANG_QUERY, LANG_COOKIE } from "facilmap-utils";
import messagesEn from "./i18n/en";
import messagesDe from "./i18n/de";
import type { i18n } from "i18next";
import type { Domain } from "domain";
import { Router } from "express";
import i18nextHttpMiddleware from "i18next-http-middleware";
import { type Socket as SocketIO } from "socket.io";

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

export function setRawDomainI18n(i18n: i18n): void {
	if (!process.domain) {
		throw new Error("Domain is not initialized");
	}

	if (!process.domain.facilmap) {
		process.domain.facilmap = {};
	}

	process.domain.facilmap.i18n = i18n;
}

export function getRawDomainI18n(): i18n | undefined {
	return process.domain?.facilmap?.i18n;
}

export const i18nMiddleware = Router();
i18nMiddleware.use((req, res, next) => {
	i18nextHttpMiddleware.handle(getRawI18n())(req, res, next);
});
i18nMiddleware.use((req, res, next) => {
	if ((req as any).i18n) {
		setRawDomainI18n(req.i18n);
	}

	next();
});

export async function handleSocketConnection(socket: SocketIO): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const req = {
			query: socket.handshake.query,
			url: socket.handshake.url,
			headers: socket.handshake.headers
		} as any;

		const res = {
			headers: {},
			setHeader: () => undefined
		} as any;

		i18nMiddleware(req, res, (err) => {
			if (err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});
}

if (!isCustomLanguageDetector) {
	setLanguageDetector(i18nextHttpMiddleware.LanguageDetector, {
		order: ["querystring", "cookie", "header"],
		lookupQuerystring: LANG_QUERY,
		lookupCookie: LANG_COOKIE
	});
}

if (!isCustomI18nGetter) {
	setI18nGetter(() => {
		return getRawDomainI18n() ?? defaultI18nGetter();
	});
}

export function getI18n(): {
	t: i18n["t"];
	changeLanguage: (lang: string) => Promise<void>;
} {
	return {
		t: getRawI18n().getFixedT(null, namespace),
		changeLanguage: async (lang) => {
			const i18n = getRawDomainI18n();
			if (!i18n) {
				throw new Error("Domain not initialized, refusing to change language for main instance.");
			}

			await i18n.changeLanguage(lang);
		}
	};
}