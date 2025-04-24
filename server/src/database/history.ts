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


	async getPagedHistory(mapId: ID, paging: PagingInput): Promise<PagedResults<RawHistoryEntry>> {
		return await this.backend.getPagedHistory(mapId, paging);
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


	async clearHistory(mapId: ID): Promise<void> {
		await this.backend.clearHistory(mapId);
	}

}
