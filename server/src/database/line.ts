import { type ID, type Point, type Route, type TrackPoint, type CRU, type RouteInfo, type LinePoints, type BboxWithExcept, entries, type Type, type Line } from "facilmap-types";
import Database from "./database.js";
import { groupBy, isEqual, omit } from "lodash-es";
import { calculateRouteForLine } from "../routing/routing.js";
import { resolveCreateLine, resolveUpdateLine } from "facilmap-utils";
import { getI18n } from "../i18n.js";
import type DatabaseLinesBackend from "../database-backend/line.js";
import type { RawLine } from "../utils/permissions.js";

export default class DatabaseLines {

	protected db: Database;
	protected backend: DatabaseLinesBackend;

	constructor(database: Database) {
		this.db = database;
		this.backend = database.backend.lines;
	}

	getMapLines(mapId: ID, fields?: Array<keyof RawLine>): AsyncIterable<RawLine> {
		return this.backend.getMapLines(mapId, fields);
	}

	getMapLinesByType(mapId: ID, typeId: ID): AsyncIterable<RawLine> {
		return this.backend.getMapLinesByType(mapId, typeId);
	}

	async lineExists(mapId: ID, lineId: ID): Promise<boolean> {
		return await this.backend.lineExists(mapId, lineId);
	}

	async getLine(mapId: ID, lineId: ID, options?: { notFound404?: boolean }): Promise<RawLine> {
		const line = await this.backend.getLine(mapId, lineId);
		if (!line) {
			throw Object.assign(
				new Error(getI18n().t("database.object-not-found-in-map-error", { type: "Line", id: lineId, mapId })),
				options?.notFound404 ? { status: 404 } : {}
			);
		}
		return line;
	}

	async createLine(mapId: ID, data: Line<CRU.CREATE_VALIDATED>, options: {
		id?: ID;
		trackPointsFromRoute?: Route & { trackPoints: AsyncIterable<TrackPoint> };
		identity: Buffer | undefined;
	}): Promise<RawLine> {
		const type = await this.db.types.getType(mapId, data.typeId);
		if (type.type !== "line") {
			throw new Error(getI18n().t("database.cannot-use-type-for-line-error", { type: type.type }));
		}

		const resolvedData = resolveCreateLine(data, type);

		const { trackPoints, ...routeInfo } = options?.trackPointsFromRoute ?? await calculateRouteForLine(resolvedData);

		const createdLine = await this.backend.createLine(mapId, {
			...omit({ ...resolvedData, ...routeInfo }, "trackPoints" /* Part of data if mode is track */),
			...options?.id ? { id: options.id } : {},
			identity: options.identity ?? null
		});

		// We have to emit this before calling _setLinePoints so that this event is sent to the client first
		this.db.emit("line", mapId, createdLine);

		await Promise.all([
			this.db.history.addHistoryEntry(mapId, {
				type: "Line",
				action: "create",
				identity: options.identity ?? null,
				objectId: createdLine.id,
				objectAfter: createdLine
			}),
			this.setLinePoints(mapId, createdLine, trackPoints)
		]);

		return createdLine;
	}

	async updateLine(mapId: ID, lineId: ID, data: Line<CRU.UPDATE_VALIDATED>, options: {
		trackPointsFromRoute?: Route & { trackPoints: AsyncIterable<TrackPoint> };
		notFound404?: boolean;
		noHistory?: boolean;
		identity: Buffer | undefined;
	}): Promise<RawLine> {
		const originalLine = await this.getLine(mapId, lineId, { notFound404: options?.notFound404 });
		const newType = await this.db.types.getType(mapId, data.typeId ?? originalLine.typeId);
		return await this._updateLine(originalLine, data, newType, options);
	}

	async _updateLine(originalLine: RawLine, data: Line<CRU.UPDATE_VALIDATED>, newType: Type, options: {
		trackPointsFromRoute?: Route & { trackPoints: AsyncIterable<TrackPoint> };
		notFound404?: boolean;
		noHistory?: boolean;
		identity: Buffer | undefined;
	}): Promise<RawLine> {
		const { mapId, id: lineId } = originalLine;

		if (newType.type !== "line") {
			throw new Error(getI18n().t("database.cannot-use-type-for-line-error", { type: newType.type }));
		}

		const update = resolveUpdateLine(originalLine, data, newType);

		let routeInfo: (RouteInfo & { trackPoints: TrackPoint[] | AsyncIterable<TrackPoint> }) | undefined;
		if ((update.mode == "track" && update.trackPoints) || (update.routePoints && !isEqual(update.routePoints, originalLine.routePoints)) || (update.mode != null && update.mode != originalLine.mode)) {
			routeInfo = options?.trackPointsFromRoute ?? await calculateRouteForLine({ ...originalLine, ...update });
		}

		delete update.trackPoints; // They came if mode is track

		if (Object.keys(update).length > 0) {
			await this.backend.updateLine(mapId, lineId, update);

			const newLine = await this.getLine(mapId, lineId);
			if (!options?.noHistory) {
				await this.db.history.addHistoryEntry(mapId, {
					type: "Line",
					action: "update",
					identity: options.identity ?? null,
					objectId: lineId,
					objectBefore: originalLine,
					objectAfter: newLine
				});
			}

			this.db.emit("line", mapId, newLine);

			if (routeInfo) {
				await this.setLinePoints(mapId, newLine, routeInfo.trackPoints);
			}

			return newLine;
		} else {
			return originalLine;
		}
	}

	protected async setLinePoints(mapId: ID, line: RawLine, trackPoints: Point[] | AsyncIterable<Point>, _noEvent?: boolean): Promise<void> {
		let first = true;
		await this.backend.setLinePoints(mapId, line.id, trackPoints, (batch) => {
			if (!_noEvent) {
				this.db.emit("linePoints", mapId, { line, trackPoints: batch.map((point) => omit(point, ["id", "lineId", "pos"]) as TrackPoint), reset: first });
			}
			first = false;
		});

		if(first && !_noEvent) {
			this.db.emit("linePoints", mapId, { line, trackPoints: [], reset: true });
		}
	}

	async deleteLine(mapId: ID, lineId: ID, options: {
		notFound404?: boolean;
		identity: Buffer | undefined;
	}): Promise<RawLine> {
		const oldLine = await this.getLine(mapId, lineId, options);
		await this._deleteLine(oldLine, options);
		return oldLine;
	}

	async _deleteLine(line: RawLine, options: { identity: Buffer | undefined }): Promise<void> {
		await this.setLinePoints(line.mapId, line, [ ], true);
		await this.backend.deleteLine(line.mapId, line.id);
		this.db.emit("deleteLine", line.mapId, line);
		await this.db.history.addHistoryEntry(line.mapId, {
			type: "Line",
			action: "delete",
			identity: options.identity ?? null,
			objectId: line.id,
			objectBefore: line
		});
	}

	async* getLinePointsForMap(mapId: ID, bboxWithZoom?: BboxWithExcept): AsyncIterable<LinePoints & { typeId: ID }> {
		for await (const line of this.getMapLines(mapId)) {

		}

		for await (const chunk of this.backend.getLinePointsForMap(mapId, bboxWithZoom)) {
			const typeIds = await this.backend.getTypeIdsForLines(mapId, chunk.map((c) => c.lineId));
			for (const [key, val] of entries(groupBy(chunk, "lineId"))) {
				yield {
					lineId: Number(key),
					typeId: typeIds[key as `${number}`],
					trackPoints: val.map((p) => omit(p, ["lineId"]))
				};
			}
		}
	}

	getLinePointsForLine(lineId: ID, bboxWithZoom?: BboxWithExcept): AsyncIterable<TrackPoint> {
		return this.backend.getLinePointsForLine(lineId, bboxWithZoom);
	}

}
