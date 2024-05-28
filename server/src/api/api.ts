import { ApiVersion } from "facilmap-types";
import type Database from "../database/database";
import { Router } from "express";
import { ApiV3Backend, apiV3Impl } from "./api-v3";
import { arrayStream, serializeJsonValue } from "json-stream-es";
import { writableToWeb } from "../utils/streams";

const apiBackend = {
	[ApiVersion.V3]: ApiV3Backend
} satisfies Record<ApiVersion, any>;

const apiImpl = {
	[ApiVersion.V3]: apiV3Impl
} satisfies Record<ApiVersion, any>;

function getSingleApiMiddleware(version: ApiVersion, database: Database): Router {
	const router = Router();

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
			if (sendResult === "empty") {
				res.status(204).send();
			} else if (sendResult === "json") {
				res.header("Content-type", "application/json");
				res.json(result);
			} else if (sendResult === "stream") {
				res.header("Content-type", "application/json");
				void serializeJsonValue({
					results: arrayStream(result.results)
				}, "\t").pipeTo(writableToWeb(res));
			} else {
				sendResult(res, result);
			}
		});
	}

	return router;
}

export function getApiMiddleware(database: Database): Router {
	const router = Router();

	for (const v of Object.values(ApiVersion)) {
		router.use(`/${v}`, getSingleApiMiddleware(v, database));
	}

	return router;
}