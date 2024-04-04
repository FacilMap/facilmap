import { defaultI18nGetter, getRawI18n, onI18nReady, setLanguageDetector, setI18nGetter, isCustomLanguageDetector, isCustomI18nGetter, LANG_QUERY, LANG_COOKIE, setCurrentUnitsGetter } from "facilmap-utils";
import messagesEn from "./i18n/en";
import messagesDe from "./i18n/de";
import type { i18n } from "i18next";
import type { Domain } from "domain";
import { Router } from "express";
import i18nextHttpMiddleware from "i18next-http-middleware";
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

declare module 'domain' {
	interface Domain {
		facilmap?: {
			i18n?: i18n;
			units?: Units;
		}
	}
}

onI18nReady((i18n) => {
	i18n.addResourceBundle("en", namespace, messagesEn);
	i18n.addResourceBundle("de", namespace, messagesDe);
});

export function getRawDomainI18n(): i18n | undefined {
	return process.domain?.facilmap?.i18n;
}

export function setRawDomainI18n(i18n: i18n): void {
	if (!process.domain) {
		throw new Error("Domain is not initialized");
	}

	if (!process.domain.facilmap) {
		process.domain.facilmap = {};
	}

	process.domain.facilmap.i18n = i18n;
}

export function getDomainUnits(): Units | undefined {
	return process.domain?.facilmap?.units;
}

export function setDomainUnits(units: Units | undefined): void {
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
	i18nextHttpMiddleware.handle(getRawI18n())(req, res, next);
});
i18nMiddleware.use((req, res, next) => {
	if ((req as any).i18n) {
		setRawDomainI18n(req.i18n);
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

setCurrentUnitsGetter(() => getDomainUnits());

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