import { defaultI18nGetter, getRawI18n, onI18nReady, setLanguageDetector, setI18nGetter, isCustomLanguageDetector, isCustomI18nGetter, LANG_QUERY, LANG_COOKIE, setCurrentUnitsGetter } from "facilmap-utils";
import messagesEn from "./i18n/en.json";
import messagesCs from "./i18n/cs.json";
import messagesDe from "./i18n/de.json";
import messagesEs from "./i18n/es.json";
import messagesFr from "./i18n/fr.json";
import messagesNbNo from "./i18n/nb-NO.json";
import messagesRu from "./i18n/ru.json";
import messagesTa from "./i18n/ta.json";
import messagesZhHant from "./i18n/zh-Hant.json";
import type { i18n } from "i18next";
import type { Domain } from "domain";
import { Router } from "express";
import * as i18nextHttpMiddleware from "i18next-http-middleware";
import { type Socket as SocketIO } from "socket.io";
import { unitsValidator, type Units } from "facilmap-types";
import { parse } from "cookie";

const namespace = "facilmap-server";

declare global {
	namespace NodeJS {
		interface Process {
			domain?: Domain;
		}
	}
}

type FacilMapProcessLang = {
	i18n: i18n;
	acceptLanguage: string | undefined;
	isExplicit: boolean;
};

declare module 'domain' {
	interface Domain {
		facilmap?: {
			lang?: FacilMapProcessLang;
			units?: Units;
		}
	}
}

onI18nReady((i18n) => {
	i18n.addResourceBundle("en", namespace, messagesEn);
	i18n.addResourceBundle("cs", namespace, messagesCs);
	i18n.addResourceBundle("de", namespace, messagesDe);
	i18n.addResourceBundle("es", namespace, messagesEs);
	i18n.addResourceBundle("fr", namespace, messagesFr);
	i18n.addResourceBundle("nb-NO", namespace, messagesNbNo);
	i18n.addResourceBundle("ru", namespace, messagesRu);
	i18n.addResourceBundle("ta", namespace, messagesTa);
	i18n.addResourceBundle("zh-Hant", namespace, messagesZhHant);
});

export function getDomainLang(): FacilMapProcessLang | undefined {
	return process.domain?.facilmap?.lang;
}

export function setDomainLang(lang: FacilMapProcessLang): void {
	if (!process.domain) {
		throw new Error("Domain is not initialized");
	}

	if (!process.domain.facilmap) {
		process.domain.facilmap = {};
	}

	process.domain.facilmap.lang = lang;
}

export function getDomainUnits(): Units | undefined {
	return process.domain?.facilmap?.units;
}

export function setDomainUnits(units: Units): void {
	if (!process.domain) {
		throw new Error("Domain is not initialized");
	}

	if (!process.domain.facilmap) {
		process.domain.facilmap = {};
	}

	process.domain.facilmap.units = units;
}

export const i18nMiddleware = Router();
i18nMiddleware.use((req, res, next) => {
	void i18nextHttpMiddleware.handle(getRawI18n())(req, res, next);
});
i18nMiddleware.use((req, res, next) => {
	if ((req as any).i18n) {
		setDomainLang({
			i18n: req.i18n,
			isExplicit: !!req.query[LANG_QUERY] || !!req.cookies[LANG_COOKIE],
			acceptLanguage: req.headers["accept-language"]
		});
	}

	const queryUnits = req.query.units ? unitsValidator.safeParse(req.query.units) : undefined;
	if (queryUnits?.success) {
		setDomainUnits(queryUnits.data);
	} else {
		const cookieUnits = req.cookies.units ? unitsValidator.safeParse(req.cookies.units) : undefined;
		if (cookieUnits?.success) {
			setDomainUnits(cookieUnits.data);
		}
	}

	next();
});

export async function handleSocketConnection(socket: SocketIO): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const req = {
			query: socket.handshake.query,
			url: socket.handshake.url,
			headers: socket.handshake.headers,
			cookies: socket.handshake.headers.cookie ? parse(socket.handshake.headers.cookie) : Object.create(null)
		} as any;

		const res = {
			headers: {},
			setHeader: () => undefined
		} as any;

		void i18nMiddleware(req, res, (err) => {
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
		return getDomainLang()?.i18n ?? defaultI18nGetter();
	});
}

setCurrentUnitsGetter(() => getDomainUnits());

export function getI18n(): {
	t: i18n["t"];
	changeLanguage: (lang: string) => Promise<void>;
} {
	return {
		t: getRawI18n().getFixedT(null, namespace),
		changeLanguage: async (lang) => {
			const domainLang = getDomainLang();
			if (!domainLang) {
				throw new Error("Domain not initialized, refusing to change language for main instance.");
			}

			await domainLang.i18n.changeLanguage(lang);
			domainLang.isExplicit = true;
		}
	};
}
