import Database from "./database.js";
import type { HistoryEntryType, ID, PagedResults, PagingInput } from "facilmap-types";
import { cloneDeep } from "lodash-es";
import { getI18n } from "../i18n.js";
import type DatabaseHistoryBackend from "../database-backend/history.js";
import type { RawHistoryEntry } from "../utils/permissions.js";
import type { Optional } from "facilmap-utils";

export default class DatabaseHistory {

	protected db: Database;
	protected backend: DatabaseHistoryBackend;

	constructor(database: Database) {
		this.db = database;
		this.backend = database.backend.history;
	}


	async addHistoryEntry(mapId: ID, data: Optional<Omit<RawHistoryEntry, "mapId">, "id" | "time">): Promise<RawHistoryEntry> {
		const dataClone = cloneDeep(data);
		if (dataClone.objectBefore) {
			delete (dataClone.objectBefore as any).id;
			delete (dataClone.objectBefore as any).mapId;
			delete (dataClone.objectBefore as any).defaultView;
		}
		if (dataClone.objectAfter) {
			delete (dataClone.objectAfter as any).id;
			delete (dataClone.objectAfter as any).mapId;
			delete (dataClone.objectAfter as any).defaultView;
		}

		const newEntry = await this.backend.addHistoryEntry(mapId, dataClone);

		this.db.emit("historyEntry", mapId, newEntry);

		return newEntry;
	}


	async updateHistoryEntry(mapId: ID, historyEntryId: ID, data: Pick<RawHistoryEntry, "objectAfter">): Promise<RawHistoryEntry> {
		await this.backend.updateHistoryEntry(mapId, historyEntryId, data);
		const newEntry = await this.getHistoryEntry(mapId, historyEntryId);
		this.db.emit("historyEntry", mapId, newEntry);
		return newEntry;
	}


	async getPagedHistory(mapId: ID, types: HistoryEntryType[] | undefined, paging: PagingInput): Promise<PagedResults<RawHistoryEntry>> {
		return await this.backend.getPagedHistory(mapId, types, paging);
	}


	getHistory(mapId: ID, types?: HistoryEntryType[]): AsyncIterable<RawHistoryEntry> {
		return this.backend.getHistory(mapId, types);
	}


	async getHistoryEntry(mapId: ID, entryId: ID, options?: { notFound404?: boolean }): Promise<RawHistoryEntry> {
		const result = await this.backend.getHistoryEntry(mapId, entryId);
		if (!result) {
			throw Object.assign(
				new Error(getI18n().t("database.object-not-found-in-map-error", { type: "History", id: entryId, mapId })),
				options?.notFound404 ? { status: 404 } : {}
			);
		}
		return result;
	}


	async revertHistoryEntry(mapId: ID, id: ID): Promise<void> {
		const entry = await this.getHistoryEntry(mapId, id);

		if(entry.type == "Map") {
			if (!entry.objectBefore) {
				throw new Error(getI18n().t("database.old-map-data-not-available-error"));
			}
			await this.db.maps.updateMapData(mapId, entry.objectBefore);
			return;
		} else if (!["Marker", "Line", "View", "Type"].includes(entry.type)) {
			throw new Error(getI18n().t("database.unknown-type-error", { type: entry.type }));
		}

		const existsNow = (
			entry.type === "Marker" ? await this.db.markers.markerExists(mapId, entry.objectId) :
			entry.type === "Line" ? await this.db.lines.lineExists(mapId, entry.objectId) :
			entry.type === "Type" ? await this.db.types.typeExists(mapId, entry.objectId) :
			await this.db.views.viewExists(mapId, entry.objectId)
		);

		if(entry.action == "create") {
			if (!existsNow)
				return;

			switch (entry.type) {
				case "Marker":
					await this.db.markers.deleteMarker(mapId, entry.objectId);
					break;

				case "Line":
					await this.db.lines.deleteLine(mapId, entry.objectId);
					break;

				case "View":
					await this.db.views.deleteView(mapId, entry.objectId);
					break;

				case "Type":
					await this.db.types.deleteType(mapId, entry.objectId);
					break;
			}
		} else if(existsNow) {
			switch (entry.type) {
				case "Marker":
					await this.db.markers.updateMarker(mapId, entry.objectId, entry.objectBefore);
					break;

				case "Line":
					await this.db.lines.updateLine(mapId, entry.objectId, entry.objectBefore);
					break;

				case "View":
					await this.db.views.updateView(mapId, entry.objectId, entry.objectBefore);
					break;

				case "Type":
					await this.db.types.updateType(mapId, entry.objectId, entry.objectBefore);
					break;
			}
		} else {
			switch (entry.type) {
				case "Marker":
					await this.db.markers.createMarker(mapId, entry.objectBefore, { id: entry.objectId });
					break;

				case "Line":
					await this.db.lines.createLine(mapId, entry.objectBefore, { id: entry.objectId });
					break;

				case "View":
					await this.db.views.createView(mapId, entry.objectBefore, { id: entry.objectId });
					break;

				case "Type":
					await this.db.types.createType(mapId, entry.objectBefore, { id: entry.objectId });
					break;
			}
		}
	}


	async clearHistory(mapId: ID): Promise<void> {
		await this.backend.clearHistory(mapId);
	}

}
