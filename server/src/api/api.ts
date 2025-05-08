import { ApiVersion } from "facilmap-types";
import type Database from "../database/database";
import { Router, type ErrorRequestHandler } from "express";
import { ApiV3Backend, apiV3Impl } from "./api-v3";
import { arrayStream, stringifyJsonStream } from "json-stream-es";
import { writableToWeb } from "../utils/streams";
import { serializeError } from "serialize-error";
import bodyParser from "body-parser";

const apiBackend = {
	[ApiVersion.V3]: ApiV3Backend
} satisfies Record<ApiVersion, any>;

const apiImpl = {
	[ApiVersion.V3]: apiV3Impl
} satisfies Record<ApiVersion, any>;

function getSingleApiMiddleware(version: ApiVersion, database: Database): Router {
	const router = Router();

	router.use(bodyParser.json());

	for (const [func, { method, route, getParams, sendResult }] of Object.entries(apiImpl[version])) {
		router[method](route, async (req, res) => {
			let params;
			try {
				params = getParams(req);
			} catch (err: any) {
				if (err.status == null && err.statusCode == null) {
					err.status = 400;
				}
				throw err;
			}

			const api = new apiBackend[version](database, req.ip);
			const result = await (api as any)[func](...params);
			res.setHeader("Referrer-Policy", "origin"); // For results opened in the browser, such as table
			if (sendResult === "empty") {
				res.status(204).send();
			} else if (sendResult === "json") {
				res.header("Content-type", "application/json");
				res.json(result);
			} else if (sendResult === "stream") {
				res.header("Content-type", "application/json");
				void stringifyJsonStream({
					results: arrayStream(result.results)
				}, "\t").pipeTo(writableToWeb(res));
			} else if (sendResult === "export") {
				res.set("Content-type", result.type);
				res.attachment(result.filename);
				void result.data.pipeTo(writableToWeb(res));
			} else {
				sendResult(res, result);
			}
		});
	}

	// Error handler, needs to be last
	router.use(((err, req, res, next) => {
		if (res.headersSent) {
			return next(err);
		}

		res.set("Content-type", "text/plain; charset=utf-8");
		if (err) {
			res.set("X-FacilMap-Error", JSON.stringify(serializeError(err)));
			res.status(err.status ?? err.statusCode ?? 500);
			if (err.headers) {
				res.setHeaders(new Headers(err.headers));
			}
			res.send(err.stack);
		} else {
			res.status(404);
			res.send("Not found");
		}
	}) satisfies ErrorRequestHandler);

	return router;
}

export function getApiMiddleware(database: Database): Router {
	const router = Router();

	for (const v of Object.values(ApiVersion)) {
		router.use(`/${v}`, getSingleApiMiddleware(v, database));
	}

	return router;
}