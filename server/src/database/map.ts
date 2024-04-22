import { DataTypes, type InferAttributes, type InferCreationAttributes, Model, Op, Sequelize, type ForeignKey } from "sequelize";
import type { CRU, FindMapsQuery, FindMapsResult, MapData, MapId, PagedResults } from "facilmap-types";
import Database from "./database.js";
import { createModel } from "./helpers.js";
import type { ViewModel } from "./view.js";
import { getI18n } from "../i18n.js";

type RawMapData = Omit<MapData, "defaultView"> & { defaultView?: NonNullable<MapData["defaultView"]> };

export interface MapModel extends Model<InferAttributes<MapModel>, InferCreationAttributes<MapModel>> {
	id: MapId;
	name: string;
	writeId: MapId;
	adminId: MapId;
	searchEngines: boolean;
	description: string;
	clusterMarkers: boolean;
	legend1: string;
	legend2: string;
	defaultViewId: ForeignKey<ViewModel["id"]> | null
	toJSON: () => RawMapData;
};

function fixMapData(rawMapData: RawMapData): MapData {
	return {
		...rawMapData,
		defaultView: rawMapData.defaultView ?? null
	};
}

export default class DatabaseMaps {

	MapModel = createModel<MapModel>();

	_db: Database;

	constructor(database: Database) {
		this._db = database;

		this.MapModel.init({
			id : { type: DataTypes.STRING, allowNull: false, primaryKey: true, validate: { is: /^.+$/ } },
			name: { type: DataTypes.TEXT, allowNull: false },
			writeId: { type: DataTypes.STRING, allowNull: false, validate: { is: /^.+$/ } },
			adminId: { type: DataTypes.STRING, allowNull: false, validate: { is: /^.+$/ } },
			searchEngines: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
			description: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
			clusterMarkers: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
			legend1: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
			legend2: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" }
		}, {
			sequelize: this._db._conn,
			modelName: "Map"
		});
	}

	afterInit(): void {
		this.MapModel.belongsTo(this._db.views.ViewModel, { as: "defaultView", foreignKey: "defaultViewId", constraints: false });
	}

	// =====================================================================================================================

	async mapIdExists(mapId: MapId): Promise<boolean> {
		const num = await this.MapModel.count({ where: { [Op.or]: [ { id: mapId }, { writeId: mapId }, { adminId: mapId } ] } });
		return num > 0;
	}

	async getMapData(mapId: MapId): Promise<MapData | undefined> {
		const obj = await this.MapModel.findOne({ where: { id: mapId }, include: [ { model: this._db.views.ViewModel, as: "defaultView" } ]});
		return obj ? fixMapData(obj.toJSON()) : undefined;
	}

	async getMapDataByWriteId(writeId: MapId): Promise<MapData | undefined> {
		const obj = await this.MapModel.findOne({ where: { writeId: writeId }, include: [ { model: this._db.views.ViewModel, as: "defaultView" } ] });
		return obj ? fixMapData(obj.toJSON()) : undefined;
	}

	async getMapDataByAdminId(adminId: MapId): Promise<MapData | undefined> {
		const obj = await this.MapModel.findOne({ where: { adminId: adminId }, include: [ { model: this._db.views.ViewModel, as: "defaultView" } ] });
		return obj ? fixMapData(obj.toJSON()) : undefined;
	}

	async getMapDataByAnyId(mapId: MapId): Promise<MapData | undefined> {
		const obj = await this.MapModel.findOne({ where: { [Op.or]: { id: mapId, writeId: mapId, adminId: mapId } }, include: [ { model: this._db.views.ViewModel, as: "defaultView" } ] });
		return obj ? fixMapData(obj.toJSON()) : undefined;
	}

	async createMap(data: MapData<CRU.CREATE_VALIDATED>): Promise<MapData> {
		if(data.id == data.writeId || data.id == data.adminId || data.writeId == data.adminId)
			throw new Error(getI18n().t("database.unique-map-ids-error"));

		await Promise.all([data.id, data.writeId, data.adminId].map(async (id) => {
			if (await this.mapIdExists(id))
				throw new Error(getI18n().t("database.map-id-taken-error", { id }));
		}));

		const createdObj = await this.MapModel.create(data);

		if (data.createDefaultTypes) {
			await this._db.types.createDefaultTypes(data.id);
		}

		return fixMapData(createdObj.toJSON());
	}

	async updateMapData(mapId: MapId, data: MapData<CRU.UPDATE_VALIDATED>): Promise<MapData> {
		const oldData = await this.getMapData(mapId);

		if(!oldData)
			throw new Error(getI18n().t("map-not-found-error", { mapId }));

		if(data.id != null && data.id != mapId) {
			if (await this.mapIdExists(data.id))
				throw new Error(getI18n().t("database.map-id-taken-error", { id: data.id }));
		}

		if(data.writeId != null && data.writeId != oldData.writeId) {
			if(data.writeId == (data.id != null ? data.id : mapId))
				throw new Error(getI18n().t("database.unique-map-ids-read-write-error"));

			if (await this.mapIdExists(data.writeId))
				throw new Error(getI18n().t("database.map-id-taken-error", { id: data.writeId }));
		}

		if(data.adminId != null && data.adminId != oldData.adminId) {
			if(data.adminId == (data.id != null ? data.id : mapId))
				throw new Error(getI18n().t("database.unique-map-ids-read-admin-error"));
			if(data.adminId == (data.writeId != null ? data.writeId : oldData.writeId))
				throw new Error(getI18n().t("database.unique-map-ids-write-admin-error"));

			if (await this.mapIdExists(data.adminId))
				throw new Error(getI18n().t("database.map-id-taken-error", { id: data.adminId }));
		}

		await this.MapModel.update(data, { where: { id: mapId } });

		const newData = await this.getMapData(data.id || mapId);

		if (!newData)
			throw new Error(getI18n().t("database.map-disappeared-error"));

		await this._db.history.addHistoryEntry(data.id || mapId, {
			type: "Map",
			action: "update",
			objectBefore: oldData,
			objectAfter: newData
		});

		this._db.emit("mapData", mapId, newData);
		return newData;
	}

	async deleteMap(mapId: MapId): Promise<void> {
		const mapData = await this.getMapDataByAnyId(mapId);

		if (!mapData)
			throw new Error(getI18n().t("map-not-found-error", { mapId }));

		if (mapData.defaultViewId) {
			await this.updateMapData(mapData.id, { defaultViewId: null });
		}

		for await (const marker of this._db.markers.getMapMarkers(mapData.id)) {
			await this._db.markers.deleteMarker(mapData.id, marker.id);
		}

		for await (const line of this._db.lines.getMapLines(mapData.id, ['id'])) {
			await this._db.lines.deleteLine(mapData.id, line.id);
		}

		for await (const type of this._db.types.getTypes(mapData.id)) {
			await this._db.types.deleteType(mapData.id, type.id);
		}

		for await (const view of this._db.views.getViews(mapData.id)) {
			await this._db.views.deleteView(mapData.id, view.id);
		}

		await this._db.history.clearHistory(mapData.id);

		await this.MapModel.destroy({ where: { id: mapData.id } });

		this._db.emit("deleteMap", mapId);
	}

	async findMaps(query: FindMapsQuery): Promise<PagedResults<FindMapsResult>> {
		const like = query.query.toLowerCase().replace(/[%_\\]/g, "\\$&").replace(/[*]/g, "%").replace(/[?]/g, "_");
		const { count, rows } = await this.MapModel.findAndCountAll({
			where: Sequelize.and(
				{ searchEngines: true },
				Sequelize.where(Sequelize.fn("lower", Sequelize.col(`Map.name`)), {[Op.like]: `%${like}%`})
			),
			offset: query.start ?? 0,
			...(query.limit != null ? { limit: query.limit } : {}),
			attributes: ["id", "name", "description"]
		});

		return {
			results: rows.map((row) => row.toJSON()),
			totalLength: count
		};
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