import { type CRU, type FindMapsResult, type MapData, type MapSlug, type PagedResults, type PagingInput, type ID } from "facilmap-types";
import Database from "./database.js";
import { getI18n } from "../i18n.js";
import { createSalt, createJwtSecret, getPasswordHash, getTokenHash } from "../utils/crypt.js";
import type DatabaseMapsBackend from "../database-backend/map.js";
import { type RawMapData, type RawMapLink } from "../utils/permissions.js";
import { omit } from "lodash-es";

export default class DatabaseMaps {

	protected db: Database;
	protected backend: DatabaseMapsBackend;

	constructor(database: Database) {
		this.db = database;
		this.backend = database.backend.maps;
	}

	async mapSlugExists(mapSlug: MapSlug): Promise<boolean> {
		return await this.backend.mapSlugExists(mapSlug);
	}

	async getMapData(mapId: ID, options?: { notFound404?: boolean }): Promise<RawMapData> {
		const result = await this.backend.getMapData(mapId);
		if (!result) {
			throw Object.assign(
				new Error(getI18n().t("map-not-found-error", { mapId })),
				options?.notFound404 ? { status: 404 } : {}
			);
		}
		return result;
	}

	async getMapLinkBySlug(mapSlug: MapSlug, options?: { notFound404?: boolean }): Promise<RawMapLink> {
		const result = await this.backend.getMapLinkBySlug(mapSlug);
		if (!result) {
			throw Object.assign(
				new Error(getI18n().t("database.map-slug-not-found-error", { mapSlug })),
				options?.notFound404 ? { status: 404 } : {}
			);
		}
		return result;
	}

	async getMapLinkByHash(mapId: ID, tokenHash: string, options?: { notFound404?: boolean }): Promise<RawMapLink> {
		const result = await this.backend.getMapLinkByHash(mapId, tokenHash);
		if (!result) {
			throw Object.assign(
				new Error(getI18n().t("database.map-link-by-hash-not-found-error")),
				options?.notFound404 ? { status: 404 } : {}
			);
		}
		return result;
	}

	async createMap(data: MapData<CRU.CREATE_VALIDATED>): Promise<RawMapData> {
		await Promise.all([...new Set(data.links.map((l) => l.slug))].map(async (mapSlug) => {
			if (await this.mapSlugExists(mapSlug)) {
				throw Object.assign(new Error(getI18n().t("database.map-slug-taken-error", { mapSlug })), { status: 409 });
			}
		}));

		const salt = createSalt();

		const links = await Promise.all(data.links.map(async (link) => {
			const password = link.password !== false ? await getPasswordHash(link.password, salt) : null;
			return {
				...link,
				password,
				tokenHash: await getTokenHash(link.slug, salt, password)
			};
		}));

		const result = await this.backend.createMap({
			...data,
			links,
			salt,
			jwtSecret: createJwtSecret(),
			nextFieldId: 1
		});

		if (data.createDefaultTypes) {
			await this.db.types.createDefaultTypes(result.id);
		}

		return result;
	}

	async updateMapData(mapId: ID, data: MapData<CRU.UPDATE_VALIDATED>): Promise<RawMapData> {
		const oldData = await this.getMapData(mapId);

		if (!oldData) {
			throw Object.assign(new Error(getI18n().t("map-not-found-error", { mapId })), { status: 404 });
		}

		const links = data.links && await Promise.all(data.links.map(async (link) => {
			const oldLink = link.id && oldData.links.find((l) => l.id === link.id);
			const password = link.password == null && oldLink ? oldLink.password : typeof link.password === "string" ? await getPasswordHash(link.password, oldData.salt) : null;

			// TODO: Check existence of new link

			return {
				...omit(link, ["id"]),
				...oldLink ? { id: link.id } : {},
				password,
				tokenHash: await getTokenHash(link.slug, oldData.salt, password)
			};
		}));

		// TODO: Validate links array with create validator

		await this.backend.updateMapData(mapId, { ...data, links });

		const newData = await this.getMapData(mapId);

		if (!newData) {
			throw new Error(getI18n().t("database.map-disappeared-error"));
		}

		await this.db.history.addHistoryEntry(mapId, {
			type: "Map",
			action: "update",
			objectBefore: omit(oldData, ["salt", "jwtSecret", "nextFieldId"]),
			objectAfter: omit(newData, ["salt", "jwtSecret", "nextFieldId"])
		});

		this.db.emit("mapData", mapId, newData);
		return newData;
	}

	async deleteMap(mapId: ID): Promise<void> {
		const mapData = await this.getMapData(mapId);

		if (!mapData) {
			throw Object.assign(new Error(getI18n().t("map-not-found-error", { mapId })), { status: 404 });
		}

		if (mapData.defaultViewId) {
			await this.updateMapData(mapData.id, { defaultViewId: null });
		}

		for await (const marker of this.db.markers.getMapMarkers(mapData.id)) {
			await this.db.markers.deleteMarker(mapData.id, marker.id);
		}

		for await (const line of this.db.lines.getMapLines(mapData.id, ['id'])) {
			await this.db.lines.deleteLine(mapData.id, line.id);
		}

		for await (const type of this.db.types.getTypes(mapData.id)) {
			await this.db.types.deleteType(mapData.id, type.id);
		}

		for await (const view of this.db.views.getViews(mapData.id)) {
			await this.db.views.deleteView(mapData.id, view.id);
		}

		await this.db.history.clearHistory(mapData.id);

		await this.backend.deleteMap(mapData.id);

		this.db.emit("deleteMap", mapId);
	}

	async findMaps(query: string, paging?: PagingInput): Promise<PagedResults<FindMapsResult>> {
		return await this.backend.findMaps(query, paging);
	}

	async getNextFieldId(mapId: ID, increase: number): Promise<number> {
		const mapData = await this.getMapData(mapId);
		if (increase > 0) {
			await this.backend.updateMapData(mapId, { nextFieldId: mapData.nextFieldId + increase });
		}
		return mapData.nextFieldId;
	}

	/*function copyPad(fromPadId, toPadId, callback) {
		function _handleStream(stream, next, cb) {
			stream.on("data", function(data) {
				stream.pause();
				cb(data, function() {
					stream.resume();
				});
			});

			stream.on("error", next);
			stream.on("end", next);
		}

		async.auto({
			fromPadData : function(next) {
				backend.getPadData(fromPadId, next);
			},
			toPadData : function(next) {
				getPadData(toPadId, next);
			},
			padsExist : [ "fromPadData", "toPadData", function(r, next) {
				if(!r.fromPadData)
					return next(new Error("Pad "+fromPadId+" does not exist."));
				if(!r.toPadData.writable)
					return next(new Error("Destination pad is read-only."));

				toPadId = r.toPadData.id;

				next();
			}],
			copyMarkers : [ "padsExist", function(r, next) {
				_handleStream(getPadMarkers(fromPadId, null), next, function(marker, cb) {
					createMarker(toPadId, marker, cb);
				});
			}],
			copyLines : [ "padsExist", function(r, next) {
				_handleStream(getPadLines(fromPadId), next, function(line, cb) {
					async.auto({
						createLine : function(next) {
							_createLine(toPadId, line, next);
						},
						getLinePoints : function(next) {
							backend.getLinePoints(line.id, next);
						},
						setLinePoints : [ "createLine", "getLinePoints", function(r, next) {
							_setLinePoints(toPadId, r.createLine.id, r.getLinePoints, next);
						} ]
					}, cb);
				});
			}],
			copyViews : [ "padsExist", function(r, next) {
				_handleStream(getViews(fromPadId), next, function(view, cb) {
					createView(toPadId, view, function(err, newView) {
						if(err)
							return cb(err);

						if(r.fromPadData.defaultView && r.fromPadData.defaultView.id == view.id && r.toPadData.defaultView == null)
							updatePadData(toPadId, { defaultView: newView.id }, cb);
						else
							cb();
					});
				});
			}]
		}, callback);
	}*/
}