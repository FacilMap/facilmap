import type { CRU, ID, Marker, BboxWithExcept, Type } from "facilmap-types";
import Database from "./database.js";
import { getElevationForPoint, resolveCreateMarker, resolveUpdateMarker } from "facilmap-utils";
import { getI18n } from "../i18n.js";
import type DatabaseMarkersBackend from "../database-backend/marker.js";
import type { RawMarker } from "../utils/permissions.js";

export default class DatabaseMarkers {

	protected db: Database;
	protected backend: DatabaseMarkersBackend;

	constructor(database: Database) {
		this.db = database;
		this.backend = database.backend.markers;
	}

	getMapMarkers(mapId: ID, bbox?: BboxWithExcept): AsyncIterable<RawMarker> {
		return this.backend.getMapMarkers(mapId, bbox);
	}

	getMapMarkersByType(mapId: ID, typeId: ID, bbox?: BboxWithExcept): AsyncIterable<RawMarker> {
		return this.backend.getMapMarkersByType(mapId, typeId, bbox);
	}

	async markerExists(mapId: ID, markerId: ID): Promise<boolean> {
		return await this.backend.markerExists(mapId, markerId);
	}

	async getMarker(mapId: ID, markerId: ID, options?: { notFound404?: boolean }): Promise<RawMarker> {
		const marker = await this.backend.getMarker(mapId, markerId);
		if (!marker) {
			throw Object.assign(
				new Error(getI18n().t("database.object-not-found-in-map-error", { type: "Marker", id: markerId, mapId })),
				options?.notFound404 ? { status: 404 } : {}
			);
		}
		return marker;
	}

	async createMarker(mapId: ID, data: Marker<CRU.CREATE_VALIDATED>, options: { id?: ID; identity: Buffer | undefined }): Promise<RawMarker> {
		const type = await this.db.types.getType(mapId, data.typeId);
		if (type.type !== "marker") {
			throw new Error(getI18n().t("database.cannot-use-type-for-marker-error", { type: type.type }));
		}

		const resolvedData = {
			...resolveCreateMarker(data, type),
			...options?.id ? { id: options.id } : {}
		};
		const result = await this.backend.createMarker(mapId, {
			...resolvedData,
			ele: resolvedData.ele ?? null, // Set asynchronously below
			identity: options.identity ?? null
		});
		this.db.emit("marker", mapId, result);

		await this.db.history.addHistoryEntry(mapId, {
			type: "Marker",
			action: "create",
			identity: options.identity ?? null,
			objectId: result.id,
			objectAfter: result
		});

		if (resolvedData.ele === undefined) {
			getElevationForPoint(resolvedData).then(async (ele) => {
				if (ele != null) {
					await this.backend.updateMarker(mapId, result.id, { ele });
					const newMarker = await this.getMarker(mapId, result.id);
					this.db.emit("marker", mapId, newMarker, result);
					await this.db.history.updateHistoryEntry(mapId, result.id, { objectAfter: newMarker });
				}
			}).catch((err) => {
				console.warn("Error updating marker elevation", err);
			});
		}

		return result;
	}

	async updateMarker(mapId: ID, markerId: ID, data: Marker<CRU.UPDATE_VALIDATED>, options: {
		identity: Buffer | undefined;
		notFound404?: boolean;
		noHistory?: boolean;
	}): Promise<RawMarker> {
		const originalMarker = await this.getMarker(mapId, markerId, { notFound404: options?.notFound404 });

		const newType = await this.db.types.getType(mapId, data.typeId ?? originalMarker.typeId);

		return await this._updateMarker(originalMarker, data, newType, options);
	}

	async _updateMarker(originalMarker: RawMarker, data: Marker<CRU.UPDATE_VALIDATED>, newType: Type, options: {
		identity: Buffer | undefined;
		noHistory?: boolean;
	}): Promise<RawMarker> {
		const { mapId, id: markerId } = originalMarker;

		if (newType.type !== "marker") {
			throw new Error(getI18n().t("database.cannot-use-type-for-marker-error", { type: newType.type }));
		}

		const update = resolveUpdateMarker(originalMarker, data, newType);

		if (Object.keys(update).length > 0) {
			await this.backend.updateMarker(originalMarker.mapId, originalMarker.id, update);

			const result = await this.getMarker(mapId, markerId);
			if (!options?.noHistory) {
				await this.db.history.addHistoryEntry(mapId, {
					type: "Marker",
					action: "update",
					identity: options.identity ?? null,
					objectId: markerId,
					objectBefore: originalMarker,
					objectAfter: result
				});
			}

			this.db.emit("marker", originalMarker.mapId, result, originalMarker);

			if (update.lat != null && update.lon != null && update.ele === undefined) {
				getElevationForPoint({ lat: update.lat, lon: update.lon }).then(async (ele) => {
					if (ele != null) {
						await this.backend.updateMarker(mapId, markerId, { ele });
						const newMarker = await this.getMarker(mapId, result.id);
						this.db.emit("marker", mapId, newMarker, result);
						await this.db.history.updateHistoryEntry(mapId, result.id, { objectAfter: newMarker });
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

	async deleteMarker(mapId: ID, markerId: ID, options: { notFound404?: boolean; identity: Buffer | undefined }): Promise<RawMarker> {
		const oldMarker = await this.getMarker(mapId, markerId, { notFound404: options.notFound404 });
		await this._deleteMarker(oldMarker, { identity: options.identity });
		return oldMarker;
	}

	async _deleteMarker(marker: RawMarker, options: { identity: Buffer | undefined }): Promise<void> {
		await this.backend.deleteMarker(marker.mapId, marker.id);
		this.db.emit("deleteMarker", marker.mapId, marker);
		await this.db.history.addHistoryEntry(marker.mapId, {
			type: "Marker",
			action: "delete",
			identity: options.identity ?? null,
			objectId: marker.id,
			objectBefore: marker
		});
	}

}
