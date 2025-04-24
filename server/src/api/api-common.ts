import { type Request, type Response } from "express";
import type { AnyMapSlug, Api, ApiVersion, StreamedResults } from "facilmap-types";
import * as z from "zod";
import type { RouteParameters } from "express-serve-static-core";

export const stringifiedJsonValidator = z.string().transform((str) => JSON.parse(str));

export const stringArrayValidator = z.string().transform((str) => str ? str.split(",") : []);

type ApiFunc<Version extends ApiVersion, Func extends keyof Api<Version>> = (
	Api<Version>[Func] extends (...args: any) => any ? Api<Version>[Func] : never
);

type Method = "get" | "post" | "put" | "delete";

export type ApiImplObj<Version extends ApiVersion, Func extends keyof Api<Version>, Route extends string> = {
	method: Method,
	route: Route,
	getParams: (req: Request<RouteParameters<Route>>) => Parameters<ApiFunc<Version, Func>>,
	sendResult: Awaited<ReturnType<ApiFunc<Version, Func>>> extends void ? (
		"empty" | ((res: Response) => void)
	) : Awaited<ReturnType<ApiFunc<Version, Func>>> extends StreamedResults<any> ? (
		"stream" | ((res: Response, result: Awaited<ReturnType<ApiFunc<Version, Func>>>) => void)
	) : (
		"json" | ((res: Response, result: Awaited<ReturnType<ApiFunc<Version, Func>>>) => void)
	)
};

export type ApiImpl<Version extends ApiVersion> = {
	[Func in keyof Api<Version>]: ApiImplObj<Version, Func, any>;
}

function getApiImpl<Version extends ApiVersion>(method: Method): (
	<Func extends keyof Api<Version>, Route extends string>(
		route: Route,
		getParams: ApiImplObj<Version, Func, Route>["getParams"],
		sendResult: ApiImplObj<Version, Func, Route>["sendResult"]
	) => ApiImplObj<Version, Func, Route>
) {
	return (route, getParams, sendResult) => ({ method, route, getParams, sendResult });
}

export const apiImpl = {
	get: getApiImpl("get"),
	post: getApiImpl("post"),
	put: getApiImpl("put"),
	del: getApiImpl("delete")
};

export function getRequestMapSlug(req: Request<{ mapSlug: string }>): AnyMapSlug {
	const auth = req.get("Authorization");
	if (auth) {
		const m = auth.match(/^Basic (.*)$/);
		if (m) {
			const decoded = atob(m[1]).split(":", 2);
			if (decoded.length >= 2) {
				return { mapSlug: req.params.mapSlug, password: decoded[1] };
			}
		}
	}
	return req.params.mapSlug;
}