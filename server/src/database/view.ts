import type { CRU, ID, View } from "facilmap-types";
import Database from "./database.js";
import { iterableToArray } from "../utils/streams.js";
import { insertIdx } from "facilmap-utils";
import type DatabaseViewsBackend from "../database-backend/view.js";
import { getI18n } from "../i18n.js";

export default class DatabaseViews {

	protected db: Database;
	protected backend: DatabaseViewsBackend;

	constructor(database: Database) {
		this.db = database;
		this.backend = database.backend.views;
	}

	getViews(mapId: ID): AsyncIterable<View> {
		return this.backend.getViews(mapId);
	}

	async viewExists(mapId: ID, viewId: ID): Promise<boolean> {
		return await this.backend.viewExists(mapId, viewId);
	}

	async getView(mapId: ID, viewId: ID, options?: { notFound404?: boolean }): Promise<View> {
		const result = await this.backend.getView(mapId, viewId);
		if (!result) {
			throw Object.assign(
				new Error(getI18n().t("database.object-not-found-in-map-error", { type: "View", id: viewId, mapId })),
				options?.notFound404 ? { status: 404 } : {}
			);
		}
		return result;
	}

	async _freeViewIdx(mapId: ID, viewId: ID | undefined, newIdx: number | undefined): Promise<number> {
		const existingViews = await iterableToArray(this.getViews(mapId));

		const resolvedNewIdx = newIdx ?? (existingViews.length > 0 ? existingViews[existingViews.length - 1].idx + 1 : 0);

		const newIndexes = insertIdx(existingViews, viewId, resolvedNewIdx).reverse();

		for (const obj of newIndexes) {
			if ((viewId == null || obj.id !== viewId) && obj.oldIdx !== obj.newIdx) {
				await this.backend.updateView(mapId, obj.id, { idx: obj.newIdx });
				const newData = await this.getView(mapId, obj.id);
				this.db.emit("view", mapId, newData);
			}
		}

		return resolvedNewIdx;
	}

	async createView(mapId: ID, data: View<CRU.CREATE_VALIDATED>, options: {
		id?: ID;
		identity: Buffer | undefined;
	}): Promise<View> {
		const idx = await this._freeViewIdx(mapId, undefined, data.idx);

		const newData = await this.backend.createView(mapId, {
			...data,
			idx,
			...options?.id ? { id: options.id } : {}
		});

		this.db.emit("view", mapId, newData);

		await this.db.history.addHistoryEntry(mapId, {
			type: "View",
			action: "create",
			identity: options.identity ?? null,
			objectId: newData.id,
			objectAfter: newData
		});

		return newData;
	}

	async updateView(mapId: ID, viewId: ID, data: View<CRU.UPDATE_VALIDATED>, options: {
		notFound404?: boolean;
		identity: Buffer | undefined;
	}): Promise<View> {
		if (data.idx != null) {
			await this._freeViewIdx(mapId, viewId, data.idx);
		}

		const viewBefore = await this.getView(mapId, viewId, options);
		await this.backend.updateView(mapId, viewId, data);
		const viewAfter = await this.getView(mapId, viewId, options);
		this.db.emit("view", mapId, viewAfter);

		await this.db.history.addHistoryEntry(mapId, {
			type: "View",
			action: "update",
			identity: options.identity ?? null,
			objectId: viewId,
			objectBefore: viewBefore,
			objectAfter: viewAfter
		});

		return viewAfter;
	}

	async deleteView(mapId: ID, viewId: ID, options: {
		notFound404?: boolean;
		identity: Buffer | undefined;
	}): Promise<View> {
		const oldView = await this.getView(mapId, viewId, options);
		await this.backend.deleteView(mapId, viewId);
		this.db.emit("deleteView", mapId, { id: viewId });
		await this.db.history.addHistoryEntry(mapId, {
			type: "View",
			action: "delete",
			identity: options.identity ?? null,
			objectId: viewId,
			objectBefore: oldView
		});
		return oldView;
	}
}