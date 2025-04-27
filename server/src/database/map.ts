import { type CRU, type FindMapsResult, type MapData, type MapSlug, type PagedResults, type PagingInput, type ID, type MapPermissions, type ReplaceProperties, type MapLink, type DeepReadonly } from "facilmap-types";
import Database from "./database.js";
import { getI18n } from "../i18n.js";
import { createSalt, createJwtSecret, getPasswordHash } from "../utils/crypt.js";
import type DatabaseMapsBackend from "../database-backend/map.js";
import { type RawMapData } from "../utils/permissions.js";
import { omit } from "lodash-es";

function isPasswordEqual(password1: Buffer | string | null, password2: Buffer | string | null): boolean {
	return (
		(password1 == null && password2 == null)
		|| (typeof password1 === "string" && typeof password2 === "string" && password1 === password2)
		|| (password1 instanceof Buffer && password2 instanceof Buffer && password1.equals(password2))
	);
}

function validateMapLinks(links: Array<{ slug: string; password: string | Buffer | null; permissions: MapPermissions }>): void {
	if (!links.some((link) => link.permissions.admin)) {
		throw Object.assign(new Error(getI18n().t("database.no-admin-link-error")), { status: 400 });
	}

	for (let i = 0; i < links.length; i++) {
		if (links.slice(i + 1).some((l) => links[i].slug === l.slug && isPasswordEqual(links[i].password, l.password))) {
			throw Object.assign(new Error(getI18n().t("database.duplicate-map-link-error")), { status: 400 });
		}
	}
}

export default class DatabaseMaps {

	protected db: Database;
	protected backend: DatabaseMapsBackend;

	constructor(database: Database) {
		this.db = database;
		this.backend = database.backend.maps;
	}

	async mapSlugExists(mapSlug: MapSlug, options?: { ignoreMapId?: ID }): Promise<boolean> {
		return await this.backend.mapSlugExists(mapSlug, options);
	}

	async mapSlugsExist(mapSlugs: MapSlug[], options?: { ignoreMapId?: ID }): Promise<MapSlug[]> {
		return await this.backend.mapSlugsExist(mapSlugs, options);
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

	async getMapDataBySlug(mapSlug: MapSlug, options?: { notFound404?: boolean }): Promise<RawMapData> {
		const result = await this.backend.getMapDataBySlug(mapSlug);
		if (!result) {
			throw Object.assign(
				new Error(getI18n().t("map-not-found-error", { mapId: mapSlug })),
				options?.notFound404 ? { status: 404 } : {}
			);
		}
		return result;
	}

	async createMap(data: DeepReadonly<MapData<CRU.CREATE_VALIDATED>>): Promise<RawMapData> {
		validateMapLinks(data.links.map((l) => ({ ...l, password: l.password !== false ? l.password : null })));

		const exists = await this.mapSlugsExist([...new Set(data.links.map((l) => l.slug))]);
		if (exists.length > 0) {
			throw Object.assign(new Error(getI18n().t("database.map-slug-taken-error", { mapSlug: exists.join(", ") })), { status: 409 });
		}

		const salt = createSalt();

		const links = await Promise.all(data.links.map(async (link) => {
			const password = link.password !== false ? await getPasswordHash(link.password, salt) : null;
			return {
				...link,
				password
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

	async updateMapData(
		mapId: ID,
		data: ReplaceProperties<MapData<CRU.UPDATE_VALIDATED>, { links?: Array<ReplaceProperties<MapLink<CRU.CREATE_VALIDATED | CRU.UPDATE_VALIDATED>, { password?: string | false | Buffer | null }>> }>,
		options: { identity: Buffer | undefined }
	): Promise<RawMapData> {
		const oldData = await this.getMapData(mapId);

		if (!oldData) {
			throw Object.assign(new Error(getI18n().t("map-not-found-error", { mapId })), { status: 404 });
		}

		const update: Parameters<typeof this.backend.updateMapData>[1] = omit(data, ["links"]);

		if (data.links) {
			const changedSlugs = data.links.flatMap((link) => {
				const oldLink = "id" in link && link.id != null ? oldData.links.find((l) => l.id === link.id) : undefined;
				return oldLink && oldLink.slug === link.slug ? [] : [link.slug];
			});
			if (changedSlugs.length > 0) {
				const exists = await this.mapSlugsExist(changedSlugs);
				if (exists.length > 0) {
					throw Object.assign(new Error(getI18n().t("database.map-slug-taken-error", { mapSlug: exists.join(", ") })), { status: 409 });
				}
			}

			update.links = await Promise.all(data.links.map(async (link_) => {
				const link = { id: undefined, ...link_ }; // To allow TypeScript access to link.id
				const oldLink = link.id != null ? oldData.links.find((l) => l.id === link.id) : undefined;
				const password = typeof link.password === "undefined" && oldLink ? oldLink.password : typeof link.password === "object" ? link.password : typeof link.password === "string" ? await getPasswordHash(link.password, oldData.salt) : null;

				return {
					...omit(link, ["id"]),
					...oldLink ? { id: link.id } : {},
					password
				};
			}));

			validateMapLinks(update.links);
		}

		await this.backend.updateMapData(mapId, update);

		const newData = await this.getMapData(mapId);

		if (!newData) {
			throw new Error(getI18n().t("database.map-disappeared-error"));
		}

		await this.db.history.addHistoryEntry(mapId, {
			type: "Map",
			action: "update",
			identity: options.identity ?? null,
			objectBefore: omit(oldData, ["salt", "jwtSecret", "nextFieldId"]),
			objectAfter: omit(newData, ["salt", "jwtSecret", "nextFieldId"])
		});

		this.db.emit("mapData", mapId, newData);
		return newData;
	}

	async deleteMap(mapId: ID, options: { identity: Buffer | undefined }): Promise<void> {
		const mapData = await this.getMapData(mapId);

		if (!mapData) {
			throw Object.assign(new Error(getI18n().t("map-not-found-error", { mapId })), { status: 404 });
		}

		if (mapData.defaultViewId) {
			await this.updateMapData(mapData.id, { defaultViewId: null }, options);
		}

		for await (const marker of this.db.markers.getMapMarkers(mapData.id)) {
			await this.db.markers.deleteMarker(mapData.id, marker.id, options);
		}

		for await (const line of this.db.lines.getMapLines(mapData.id, ['id'])) {
			await this.db.lines.deleteLine(mapData.id, line.id, options);
		}

		for await (const type of this.db.types.getTypes(mapData.id)) {
			await this.db.types.deleteType(mapData.id, type.id, options);
		}

		for await (const view of this.db.views.getViews(mapData.id)) {
			await this.db.views.deleteView(mapData.id, view.id, options);
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