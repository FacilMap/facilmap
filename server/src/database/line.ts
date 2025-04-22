import { type CreationOptional, DataTypes, type ForeignKey, type HasManyGetAssociationsMixin, type InferAttributes, type InferCreationAttributes, Model, Op } from "sequelize";
import type { BboxWithZoom, ID, Latitude, Line, ExtraInfo, Longitude, Point, Route, TrackPoint, CRU, RouteInfo, Stroke, Colour, RouteMode, Width, Type, LinePoints } from "facilmap-types";
import Database from "./database.js";
import { chunk, groupBy, isEqual, mapValues, omit } from "lodash-es";
import { calculateRouteForLine } from "../routing/routing.js";
import type { MapModel } from "./map.js";
import type { Point as GeoJsonPoint } from "geojson";
import type { TypeModel } from "./type";
import { resolveCreateLine, resolveUpdateLine } from "facilmap-utils";
import { getI18n } from "../i18n.js";
import { mapAsyncIterable } from "../utils/streams.js";

export default class DatabaseLines {

	_db: Database;

	constructor(database: Database) {
		this._db = database;
	}

	getMapLines(mapId: ID, fields?: Array<keyof Line>): AsyncIterable<Line> {
		return this._db._backend.lines.getMapLines(mapId, fields);
	}

	getMapLinesByType(mapId: ID, typeId: ID): AsyncIterable<Line> {
		return this._db._backend.lines.getMapLinesByType(mapId, typeId);
	}

	async getLine(mapId: ID, lineId: ID, options?: { notFound404?: boolean }): Promise<Line> {
		const line = await this._db._backend.lines.getLine(mapId, lineId);
		if (!line) {
			throw Object.assign(
				new Error(getI18n().t("database.object-not-found-in-map-error", { type: "Line", id: lineId, mapId })),
				options?.notFound404 ? { status: 404 } : {}
			);
		}
		return line;
	}

	async createLine(mapId: ID, data: Line<CRU.CREATE_VALIDATED>, options?: { id?: ID; trackPointsFromRoute?: Route & { trackPoints: AsyncIterable<TrackPoint> } }): Promise<Line> {
		const type = await this._db.types.getType(mapId, data.typeId);
		if (type.type !== "line") {
			throw new Error(getI18n().t("database.cannot-use-type-for-line-error", { type: type.type }));
		}

		const resolvedData = resolveCreateLine(data, type);

		const { trackPoints, ...routeInfo } = options?.trackPointsFromRoute ?? await calculateRouteForLine(resolvedData);

		const createdLine = await this._db._backend.lines.createLine(mapId, {
			...omit({ ...resolvedData, ...routeInfo }, "trackPoints" /* Part of data if mode is track */),
			...options?.id ? { id: options.id } : {}
		});

		// We have to emit this before calling _setLinePoints so that this event is sent to the client first
		this._db.emit("line", mapId, createdLine);

		await this.setLinePoints(mapId, createdLine.id, trackPoints);

		return createdLine;
	}

	async updateLine(mapId: ID, lineId: ID, data: Line<CRU.UPDATE_VALIDATED>, options?: { trackPointsFromRoute?: Route & { trackPoints: AsyncIterable<TrackPoint> }; notFound404?: boolean }): Promise<Line> {
		const originalLine = await this.getLine(mapId, lineId, { notFound404: options?.notFound404 });

		const newType = await this._db.types.getType(mapId, data.typeId ?? originalLine.typeId);
		if (newType.type !== "line") {
			throw new Error(getI18n().t("database.cannot-use-type-for-line-error", { type: newType.type }));
		}

		const update = resolveUpdateLine(originalLine, data, newType);

		let routeInfo: (RouteInfo & { trackPoints: TrackPoint[] | AsyncIterable<TrackPoint> }) | undefined;
		if ((update.mode == "track" && update.trackPoints) || (update.routePoints && !isEqual(update.routePoints, originalLine.routePoints)) || (update.mode != null && update.mode != originalLine.mode)) {
			routeInfo = options?.trackPointsFromRoute ?? await calculateRouteForLine({ ...originalLine, ...update });
		}

		Object.assign(update, mapValues(routeInfo, (val) => val == null ? null : val)); // Use null instead of undefined
		delete update.trackPoints; // They came if mode is track

		if (Object.keys(update).length > 0) {
			await this._db._backend.lines.updateLine(mapId, lineId, update);

			const newLine = await this.getLine(mapId, lineId);
			await this._db.history.addHistoryEntry(mapId, { type: "Line", action: "update", objectId: lineId, objectBefore: originalLine, objectAfter: newLine });

			this._db.emit("line", originalLine.mapId, newLine);

			if (routeInfo) {
				await this.setLinePoints(mapId, lineId, routeInfo.trackPoints);
			}

			return newLine;
		} else {
			return originalLine;
		}
	}

	protected async setLinePoints(mapId: ID, lineId: ID, trackPoints: Point[] | AsyncIterable<Point>, _noEvent?: boolean): Promise<void> {
		let first = true;
		await this._db._backend.lines.setLinePoints(mapId, lineId, trackPoints, (batch) => {
			if (!_noEvent) {
				this._db.emit("linePoints", mapId, lineId, batch.map((point) => omit(point, ["id", "lineId", "pos"]) as TrackPoint), first);
			}
			first = false;
		});

		if(first && !_noEvent) {
			this._db.emit("linePoints", mapId, lineId, [], true);
		}
	}

	async deleteLine(mapId: ID, lineId: ID, options?: { notFound404?: boolean }): Promise<Line> {
		const oldLine = await this.getLine(mapId, lineId, options);
		await this.setLinePoints(mapId, lineId, [ ], true);
		await this._db._backend.lines.deleteLine(mapId, lineId);
		this._db.emit("deleteLine", mapId, { id: lineId });
		await this._db.history.addHistoryEntry(mapId, { type: "Line", action: "delete", objectId: lineId, objectBefore: oldLine });
		return oldLine;
	}

	async* getLinePointsForMap(mapId: ID, bboxWithZoom?: BboxWithZoom & BboxWithExcept): AsyncIterable<LinePoints> {
		const lines = await this.LineModel.findAll({ attributes: ["id"], where: { mapId } });
		const chunks = chunk(lines.map((line) => line.id), 50000);
		for (const lineIds of chunks) {
			const linePoints = await this.LinePointModel.findAll({
				where: {
					[Op.and]: [
						{
							...bboxWithZoom ? {
								zoom: { [Op.lte]: bboxWithZoom.zoom }
							} : {},
							lineId: { [Op.in]: lineIds }
						},
						this._db.helpers.makeBboxCondition(bboxWithZoom)
					]
				},
				attributes: ["pos", "lat", "lon", "ele", "zoom", "idx", "lineId"]
			});

			for (const [key, val] of Object.entries(groupBy(linePoints, "lineId"))) {
				yield {
					lineId: Number(key),
					trackPoints: val.map((p) => omit(p.toJSON(), ["lineId", "pos"]))
				};
			}
		}
	}

	async* getLinePointsForLine(lineId: ID, bboxWithZoom?: BboxWithZoom & BboxWithExcept): AsyncIterable<TrackPoint> {
		for await (const linePoint of findAllStreamed(this.LinePointModel, {
			attributes: [ /* Needed for findAllStreamed */ "id", "pos", "lat", "lon", "ele", "zoom", "idx" ],
			order: [["idx", "ASC"]],
			where: {
				lineId,
				...bboxWithZoom ? {
					[Op.and]: [
						{ zoom: { [Op.lte]: bboxWithZoom.zoom } },
						this._db.helpers.makeBboxCondition(bboxWithZoom)
					]
				} : {}
			}
		})) {
			yield omit(linePoint.toJSON(), ["id", "pos"]) as TrackPoint;
		}
	}

}
