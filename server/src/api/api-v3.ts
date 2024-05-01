import { Router, type Request, type Response } from "express";
import { allMapObjectsPickValidator, bboxWithExceptValidator, bboxWithZoomValidator, exportFormatValidator, lineValidator, mapDataValidator, markerValidator, pagingValidator, pointValidator, routeModeValidator, stringifiedBooleanValidator, stringifiedIdValidator, typeValidator, viewValidator, type Api, type StreamedResults } from "facilmap-types";
import * as z from "zod";
import type Database from "../database/database";
import { ApiBackend } from "./api";
import { Writable } from "stream";
import { jsonStreamArray, jsonStreamRecord } from "../utils/streams";
import type { RouteParameters } from "express-serve-static-core";

const stringifiedJsonValidator = z.string().transform((str) => JSON.parse(str));

const stringArrayValidator = z.string().transform((str) => str ? str.split(",") : []);

type ApiImpl<Func extends keyof Api, Route extends string> = {
	method: "get" | "post" | "put" | "delete",
	route: Route,
	getParams: (req: Request<RouteParameters<Route>>) => Parameters<Api[Func]>,
	sendResult: Awaited<ReturnType<Api[Func]>> extends void ? (
		"empty" | ((res: Response) => void)
	) : Awaited<ReturnType<Api[Func]>> extends StreamedResults<any> ? (
		"stream" | ((res: Response, result: Awaited<ReturnType<Api[Func]>>) => void)
	) : (
		"json" | ((res: Response, result: Awaited<ReturnType<Api[Func]>>) => void)
	)
};

function getApiImpl(method: ApiImpl<keyof Api, string>["method"]): (<Func extends keyof Api, Route extends string>(route: Route, getParams: ApiImpl<Func, Route>["getParams"], sendResult: ApiImpl<Func, Route>["sendResult"]) => ApiImpl<Func, Route>) {
	return (route, getParams, sendResult) => ({ method, route, getParams, sendResult });
}

const get = getApiImpl("get");
const post = getApiImpl("post");
const put = getApiImpl("put");
const del = getApiImpl("delete");

// Declaring the API this way is a bit awkward compared to setting up an Express router directly, but it has the advantage
// that we can be sure to not forget an API method and that we have type safety for the return value.
const apiV3: {
	[Func in keyof Api]: ApiImpl<Func, any>;
} = {
	findMaps: get("/map", (req) => {
		const { query, ...paging } = pagingValidator.extend({
			query: z.string()
		}).parse(req.query);
		return [query, paging];
	}, "json"),

	getMap: get("/map/:mapSlug", (req) => [req.params.mapSlug], "json"),

	createMap: post("/map", (req) => [mapDataValidator.create.parse(req.body)], "stream"),

	updateMap: put("/map/:mapSlug", (req) => [req.params.mapSlug, mapDataValidator.update.parse(req.body)], "json"),

	deleteMap: del("/map/:mapSlug", (req) => [req.params.mapSlug], "empty"),

	getAllMapObjects: get("/map/:mapSlug/all", (req) => {
		const { pick, bbox } = z.object({
			pick: stringArrayValidator.pipe(z.array(allMapObjectsPickValidator)),
			bbox: stringifiedJsonValidator.pipe(bboxWithZoomValidator.optional())
		}).parse(req.query);
		return [req.params.mapSlug, { pick, bbox }];
	}, "stream"),

	findOnMap: get("/map/:mapSlug/find", (req) => {
		const { query } = z.object({
			query: z.string()
		}).parse(req.query);
		return [req.params.mapSlug, query];
	}, "json"),

	getHistory: get("/map/:mapSlug/history", (req) => {
		const paging = pagingValidator.parse(req.query);
		return [req.params.mapSlug, paging];
	}, "json"),

	revertHistoryEntry: post("/map/:mapSlug/history/:historyEntryId/revert", (req) => {
		const historyEntryId = stringifiedIdValidator.parse(req.params.historyEntryId);
		return [req.params.mapSlug, historyEntryId];
	}, "empty"),

	getMapMarkers: get("/map/:mapSlug/marker", (req) => {
		const { bbox } = z.object({
			bbox: stringifiedJsonValidator.pipe(bboxWithExceptValidator).optional()
		}).parse(req.query);
		return [req.params.mapSlug, { bbox }];
	}, "stream"),

	getMarker: get("/map/:mapSlug/marker/:markerId", (req) => {
		const markerId = stringifiedIdValidator.parse(req.params.markerId);
		return [req.params.mapSlug, markerId];
	}, "json"),

	createMarker: post("/map/:mapSlug/marker", (req) => [req.params.mapSlug, markerValidator.create.parse(req.body)], "json"),

	updateMarker: put("/map/:mapSlug/marker/:markerId", (req) => {
		const markerId = stringifiedIdValidator.parse(req.params.markerId);
		const data = markerValidator.update.parse(req.body);
		return [req.params.mapSlug, markerId, data];
	}, "json"),

	deleteMarker: del("/map/:mapSlug/marker/:markerId", (req) => {
		const markerId = stringifiedIdValidator.parse(req.params.markerId);
		return [req.params.mapSlug, markerId];
	}, "empty"),

	getMapLines: get("/map/:mapSlug/line", (req) => {
		const { bbox, includeTrackPoints } = z.object({
			bbox: stringifiedJsonValidator.pipe(bboxWithExceptValidator).optional(),
			includeTrackPoints: stringifiedBooleanValidator.optional()
		}).parse(req.query);
		return [req.params.mapSlug, { bbox, includeTrackPoints }];
	}, "stream"),

	getLine: get("/map/:mapSlug/line/:lineId", (req) => {
		const lineId = stringifiedIdValidator.parse(req.params.lineId);
		return [req.params.mapSlug, lineId];
	}, "json"),

	getLinePoints: get("/map/:mapSlug/line/:lineId/linePoints", (req) => {
		const { bbox } = stringifiedJsonValidator.pipe(z.object({
			bbox: stringifiedJsonValidator.pipe(bboxWithExceptValidator)
		})).parse(req.query);
		const lineId = stringifiedIdValidator.parse(req.params.lineId);
		return [req.params.mapSlug, lineId, bbox];
	}, "stream"),

	createLine: post("/map/:mapSlug/line", (req) => [req.params.mapSlug, lineValidator.create.parse(req.body)], "json"),

	updateLine: put("/map/:mapSlug/line/:lineId", (req) => {
		const lineId = stringifiedIdValidator.parse(req.params.lineId);
		const data = lineValidator.update.parse(req.body);
		return [req.params.mapSlug, lineId, data];
	}, "json"),

	deleteLine: del("/map/:mapSlug/line/:lineId", (req) => {
		const lineId = stringifiedIdValidator.parse(req.params.lineId);
		return [req.params.mapSlug, lineId];
	}, "empty"),

	exportLine: get("/map/:mapSlug/line/:lineId/export", (req) => {
		const lineId = stringifiedIdValidator.parse(req.params.lineId);
		const { format } = z.object({
			format: exportFormatValidator
		}).parse(req.query);
		return [req.params.mapSlug, lineId, { format }];
	}, (res, result) => {
		void result.data.pipeTo(Writable.toWeb(res));
	}),

	getMapTypes: get("/map/:mapSlug/type", (req) => [req.params.mapSlug], "stream"),

	getType: get("/map/:mapSlug/type/:typeId", (req) => {
		const typeId = stringifiedIdValidator.parse(req.params.typeId);
		return [req.params.mapSlug, typeId];
	}, "json"),

	createType: post("/map/:mapSlug/type", (req) => [req.params.mapSlug, typeValidator.create.parse(req.body)], "json"),

	updateType: put("/map/:mapSlug/type/:typeId", (req) => {
		const typeId = stringifiedIdValidator.parse(req.params.typeId);
		const data = typeValidator.update.parse(req.body);
		return [req.params.mapSlug, typeId, data];
	}, "json"),

	deleteType: del("/map/:mapSlug/type/:typeId", (req) => {
		const typeId = stringifiedIdValidator.parse(req.params.typeId);
		return [req.params.mapSlug, typeId];
	}, "empty"),

	getMapViews: get("/map/:mapSlug/view", (req) => [req.params.mapSlug], "stream"),

	getView: get("/map/:mapSlug/view/:viewId", (req) => {
		const viewId = stringifiedIdValidator.parse(req.params.viewId);
		return [req.params.mapSlug, viewId];
	}, "json"),

	createView: post("/map/:mapSlug/view", (req) => [req.params.mapSlug, viewValidator.create.parse(req.body)], "json"),

	updateView: put("/map/:mapSlug/view/:viewId", (req) => {
		const viewId = stringifiedIdValidator.parse(req.params.viewId);
		const data = viewValidator.update.parse(req.body);
		return [req.params.mapSlug, viewId, data];
	}, "json"),

	deleteView: del("/map/:mapSlug/view/:viewId", (req) => {
		const viewId = stringifiedIdValidator.parse(req.params.viewId);
		return [req.params.mapSlug, viewId];
	}, "empty"),

	find: get("/find", (req) => {
		const { query } = z.object({
			query: z.string()
		}).parse(req.query);
		return [query];
	}, "json"),

	findUrl: get("/find/url", (req) => {
		const { url } = z.object({
			url: z.string()
		}).parse(req.query);
		return [url];
	}, (res, result) => {
		void result.data.pipeTo(Writable.toWeb(res));
	}),

	getRoute: get("/route", (req) => {
		const { destinations, mode } = z.object({
			destinations: stringifiedJsonValidator.pipe(z.array(pointValidator)),
			mode: routeModeValidator
		}).parse(req.query);
		return [{ destinations, mode }];
	}, "json"),

	geoip: get("/geoip", (req) => [], (res, result) => {
		if (result) {
			res.json(result);
		} else {
			res.status(204).send();
		}
	})
};

export function getApiV3(database: Database): Router {
	const router = Router();

	for (const [func, { method, route, getParams, sendResult }] of Object.entries(apiV3)) {
		router[method](route, async (req, res) => {
			const params = getParams(req);
			const api = new ApiBackend(database, req.ip);
			const result = await (api as any)[func](...params);
			if (sendResult === "empty") {
				res.status(204).send();
			} else if (sendResult === "json") {
				res.json(result);
			} else if (sendResult === "stream") {
				void jsonStreamRecord({
					results: jsonStreamArray(result.results)
				}).pipeTo(Writable.toWeb(res));
			} else {
				sendResult(res, result);
			}
		});
	}

	return router;
}