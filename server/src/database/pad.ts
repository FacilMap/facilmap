import { DataTypes, type InferAttributes, type InferCreationAttributes, Model, Op, Sequelize, type ForeignKey } from "sequelize";
import type { CRU, FindPadsQuery, FindPadsResult, PadData, PadId, PagedResults } from "facilmap-types";
import Database from "./database.js";
import { createModel } from "./helpers.js";
import type { ViewModel } from "./view";
import { getI18n } from "../i18n.js";

type RawPadData = Omit<PadData, "defaultView"> & { defaultView?: NonNullable<PadData["defaultView"]> };

export interface PadModel extends Model<InferAttributes<PadModel>, InferCreationAttributes<PadModel>> {
	id: PadId;
	name: string;
	writeId: PadId;
	adminId: PadId;
	searchEngines: boolean;
	description: string;
	clusterMarkers: boolean;
	legend1: string;
	legend2: string;
	defaultViewId: ForeignKey<ViewModel["id"]> | null
	toJSON: () => RawPadData;
};

function fixPadData(rawPadData: RawPadData): PadData {
	return {
		...rawPadData,
		defaultView: rawPadData.defaultView ?? null
	};
}

export default class DatabasePads {

	PadModel = createModel<PadModel>();

	_db: Database;

	constructor(database: Database) {
		this._db = database;

		this.PadModel.init({
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
			modelName: "Pad"
		});
	}

	afterInit(): void {
		this.PadModel.belongsTo(this._db.views.ViewModel, { as: "defaultView", foreignKey: "defaultViewId", constraints: false });
	}

	// =====================================================================================================================

	async padIdExists(padId: PadId): Promise<boolean> {
		const num = await this.PadModel.count({ where: { [Op.or]: [ { id: padId }, { writeId: padId }, { adminId: padId } ] } });
		return num > 0;
	}

	async getPadData(padId: PadId): Promise<PadData | undefined> {
		const obj = await this.PadModel.findOne({ where: { id: padId }, include: [ { model: this._db.views.ViewModel, as: "defaultView" } ]});
		return obj ? fixPadData(obj.toJSON()) : undefined;
	}

	async getPadDataByWriteId(writeId: PadId): Promise<PadData | undefined> {
		const obj = await this.PadModel.findOne({ where: { writeId: writeId }, include: [ { model: this._db.views.ViewModel, as: "defaultView" } ] });
		return obj ? fixPadData(obj.toJSON()) : undefined;
	}

	async getPadDataByAdminId(adminId: PadId): Promise<PadData | undefined> {
		const obj = await this.PadModel.findOne({ where: { adminId: adminId }, include: [ { model: this._db.views.ViewModel, as: "defaultView" } ] });
		return obj ? fixPadData(obj.toJSON()) : undefined;
	}

	async getPadDataByAnyId(padId: PadId): Promise<PadData | undefined> {
		const obj = await this.PadModel.findOne({ where: { [Op.or]: { id: padId, writeId: padId, adminId: padId } }, include: [ { model: this._db.views.ViewModel, as: "defaultView" } ] });
		return obj ? fixPadData(obj.toJSON()) : undefined;
	}

	async createPad(data: PadData<CRU.CREATE_VALIDATED>): Promise<PadData> {
		if(data.id == data.writeId || data.id == data.adminId || data.writeId == data.adminId)
			throw new Error(getI18n().t("database.unique-pad-ids-error"));

		await Promise.all([data.id, data.writeId, data.adminId].map(async (id) => {
			if (await this.padIdExists(id))
				throw new Error(getI18n().t("database.pad-id-taken-error", { id }));
		}));

		const createdObj = await this.PadModel.create(data);

		if (data.createDefaultTypes) {
			await this._db.types.createDefaultTypes(data.id);
		}

		return fixPadData(createdObj.toJSON());
	}

	async updatePadData(padId: PadId, data: PadData<CRU.UPDATE_VALIDATED>): Promise<PadData> {
		const oldData = await this.getPadData(padId);

		if(!oldData)
			throw new Error(getI18n().t("pad-not-found-error", { padId }));

		if(data.id != null && data.id != padId) {
			if (await this.padIdExists(data.id))
				throw new Error(getI18n().t("database.pad-id-taken-error", { id: data.id }));
		}

		if(data.writeId != null && data.writeId != oldData.writeId) {
			if(data.writeId == (data.id != null ? data.id : padId))
				throw new Error(getI18n().t("database.unique-pad-ids-read-write-error"));

			if (await this.padIdExists(data.writeId))
				throw new Error(getI18n().t("database.pad-id-taken-error", { id: data.writeId }));
		}

		if(data.adminId != null && data.adminId != oldData.adminId) {
			if(data.adminId == (data.id != null ? data.id : padId))
				throw new Error(getI18n().t("database.unique-pad-ids-read-admin-error"));
			if(data.adminId == (data.writeId != null ? data.writeId : oldData.writeId))
				throw new Error(getI18n().t("database.unique-pad-ids-write-admin-error"));

			if (await this.padIdExists(data.adminId))
				throw new Error(getI18n().t("database.pad-id-taken-error", { id: data.adminId }));
		}

		await this.PadModel.update(data, { where: { id: padId } });

		const newData = await this.getPadData(data.id || padId);

		if (!newData)
			throw new Error(getI18n().t("database.pad-disappeared-error"));

		await this._db.history.addHistoryEntry(data.id || padId, {
			type: "Pad",
			action: "update",
			objectBefore: oldData,
			objectAfter: newData
		});

		this._db.emit("padData", padId, newData);
		return newData;
	}

	async deletePad(padId: PadId): Promise<void> {
		const padData = await this.getPadDataByAnyId(padId);

		if (!padData)
			throw new Error(getI18n().t("pad-not-found-error", { padId }));

		if (padData.defaultViewId) {
			await this.updatePadData(padData.id, { defaultViewId: null });
		}

		for await (const marker of this._db.markers.getPadMarkers(padData.id)) {
			await this._db.markers.deleteMarker(padData.id, marker.id);
		}

		for await (const line of this._db.lines.getPadLines(padData.id, ['id'])) {
			await this._db.lines.deleteLine(padData.id, line.id);
		}

		for await (const type of this._db.types.getTypes(padData.id)) {
			await this._db.types.deleteType(padData.id, type.id);
		}

		for await (const view of this._db.views.getViews(padData.id)) {
			await this._db.views.deleteView(padData.id, view.id);
		}

		await this._db.history.clearHistory(padData.id);

		await this.PadModel.destroy({ where: { id: padData.id } });

		this._db.emit("deletePad", padId);
	}

	async findPads(query: FindPadsQuery): Promise<PagedResults<FindPadsResult>> {
		const like = query.query.toLowerCase().replace(/[%_\\]/g, "\\$&").replace(/[*]/g, "%").replace(/[?]/g, "_");
		const { count, rows } = await this.PadModel.findAndCountAll({
			where: Sequelize.and(
				{ searchEngines: true },
				Sequelize.where(Sequelize.fn("lower", Sequelize.col(`Pad.name`)), {[Op.like]: `%${like}%`})
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