import type { CRU, ID, Marker, BboxWithExcept } from "facilmap-types";
import Database from "./database.js";
import { getElevationForPoint, resolveCreateMarker, resolveUpdateMarker } from "facilmap-utils";
import { getI18n } from "../i18n.js";

export default class DatabaseMarkers {

	_db: Database;

	constructor(database: Database) {
		this._db = database;
	}

	getMapMarkers(mapId: ID, bbox?: BboxWithExcept): AsyncIterable<Marker> {
		return this._db._backend.markers.getMapMarkers(mapId, bbox);
	}

	getMapMarkersByType(mapId: ID, typeId: ID, bbox?: BboxWithExcept): AsyncIterable<Marker> {
		return this._db._backend.markers.getMapMarkersByType(mapId, typeId, bbox);
	}

	async getMarker(mapId: ID, markerId: ID, options?: { notFound404?: boolean }): Promise<Marker> {
		const marker = await this._db._backend.markers.getMarker(mapId, markerId);
		if (!marker) {
			throw Object.assign(
				new Error(getI18n().t("database.object-not-found-in-map-error", { type: "Marker", id: markerId, mapId })),
				options?.notFound404 ? { status: 404 } : {}
			);
		}
		return marker;
	}

	async createMarker(mapId: ID, data: Marker<CRU.CREATE_VALIDATED>, options?: { id?: ID }): Promise<Marker> {
		const type = await this._db.types.getType(mapId, data.typeId);
		if (type.type !== "marker") {
			throw new Error(getI18n().t("database.cannot-use-type-for-marker-error", { type: type.type }));
		}

		const result = await this._db._backend.markers.createMarker(mapId, {
			...resolveCreateMarker(data, type),
			...options?.id ? { id: options.id } : {}
		});
		this._db.emit("marker", mapId, result);

		await this._db.history.addHistoryEntry(mapId, { type: type as any, action: "create", objectId: result.id, objectAfter: result });

		if (data.ele === undefined) {
			getElevationForPoint(data).then(async (ele) => {
				if (ele != null) {
					await this._db._backend.markers.updateMarker(mapId, result.id, { ele });
				}
			}).catch((err) => {
				console.warn("Error updating marker elevation", err);
			});
		}

		return result;
	}

	async updateMarker(mapId: ID, markerId: ID, data: Marker<CRU.UPDATE_VALIDATED>, options?: { notFound404?: boolean }): Promise<Marker> {
		const originalMarker = await this.getMarker(mapId, markerId, { notFound404: options?.notFound404 });

		const newType = await this._db.types.getType(mapId, data.typeId ?? originalMarker.typeId);
		if (newType.type !== "marker") {
			throw new Error(getI18n().t("database.cannot-use-type-for-marker-error", { type: newType.type }));
		}

		const update = resolveUpdateMarker(originalMarker, data, newType);

		if (Object.keys(update).length > 0) {
			await this._db._backend.markers.updateMarker(originalMarker.mapId, originalMarker.id, update);

			const result = await this.getMarker(mapId, markerId);
			await this._db.history.addHistoryEntry(mapId, { type: "Marker", action: "update", objectId: markerId, objectBefore: originalMarker, objectAfter: result });

			this._db.emit("marker", originalMarker.mapId, result, originalMarker);

			if (update.lat != null && update.lon != null && update.ele === undefined) {
				getElevationForPoint({ lat: update.lat, lon: update.lon }).then(async (ele) => {
					if (ele != null) {
						await this._db._backend.markers.updateMarker(mapId, markerId, { ele });
					}
				}).catch((err) => {
					console.warn("Error updating marker elevation", err);
				});
			}

			return result;
		} else {
			return originalMarker;
		}
	}

	async deleteMarker(mapId: ID, markerId: ID, options?: { notFound404?: boolean }): Promise<Marker> {
		const oldMarker = await this.getMarker(mapId, markerId, options);
		await this._db._backend.markers.deleteMarker(mapId, markerId);
		this._db.emit("deleteMarker", mapId, { id: markerId });
		await this._db.history.addHistoryEntry(mapId, { type: "Marker", action: "delete", objectId: markerId, objectBefore: oldMarker });
		return oldMarker;
	}

}
