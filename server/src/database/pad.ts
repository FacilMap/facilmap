import { Model } from "sequelize";
import { DataTypes, Op } from "sequelize";
import { PadData, PadDataCreate, PadDataUpdate, PadId } from "../../../types/src";
import Database from "./database";
import { streamEachPromise } from "../utils/streams";

function createPadModel() {
	return class PadModel extends Model {
		id!: PadId;
		name!: string;
		writeId!: PadId;
		adminId!: PadId;
		searchEngines!: boolean;
		description!: string;
		clusterMarkers!: boolean;
		legend1!: string;
		legend2!: string;
		toJSON!: () => PadData;
	};
}

export type PadModel = InstanceType<ReturnType<typeof createPadModel>>;

export default class DatabasePads {

	PadModel = createPadModel();

	_db: Database;

	constructor(database: Database) {
		this._db = database;

		this.PadModel.init({
			id : { type: DataTypes.STRING, allowNull: false, primaryKey: true, validate: { is: /^.+$/ } },
			name: { type: DataTypes.TEXT, allowNull: true, get: function(this: PadModel) { return this.getDataValue("name") || "New FacilMap"; } },
			writeId: { type: DataTypes.STRING, allowNull: false, validate: { is: /^.+$/ } },
			adminId: { type: DataTypes.STRING, allowNull: false, validate: { is: /^.+$/ } },
			searchEngines: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
			description: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
			clusterMarkers: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
			legend1: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
			legend2: { type: DataTypes.STRING, allowNull: false, defaultValue: "" }
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
		return obj?.toJSON();
	}

	async getPadDataByWriteId(writeId: PadId): Promise<PadData | undefined> {
		const obj = await this.PadModel.findOne({ where: { writeId: writeId }, include: [ { model: this._db.views.ViewModel, as: "defaultView" } ] });
		return obj?.toJSON();
	}

	async getPadDataByAdminId(adminId: PadId): Promise<PadData | undefined> {
		const obj = await this.PadModel.findOne({ where: { adminId: adminId }, include: [ { model: this._db.views.ViewModel, as: "defaultView" } ] });
		return obj?.toJSON();
	}

	async getPadDataByAnyId(padId: PadId): Promise<PadData | undefined> {
		const obj = await this.PadModel.findOne({ where: { [Op.or]: { id: padId, writeId: padId, adminId: padId } }, include: [ { model: this._db.views.ViewModel, as: "defaultView" } ] });
		return obj?.toJSON();
	}

	async createPad(data: PadDataCreate): Promise<PadData> {
		if(!data.id || data.id.length == 0)
			throw new Error("Invalid read-only ID");
		if(!data.writeId || data.writeId.length == 0)
			throw new Error("Invalid read-write ID");
		if(!data.adminId || data.adminId.length == 0)
			throw new Error("Invalid admin ID");
		if(data.id == data.writeId || data.id == data.adminId || data.writeId == data.adminId)
			throw new Error("Read-only, read-write and admin ID have to be different from each other.");

		await Promise.all([data.id, data.writeId, data.adminId].map(async (id) => {
			if (await this.padIdExists(id))
				throw new Error("ID '" + id + "' is already taken.");
		}));

		const createdObj = await this.PadModel.create(data);

		await this._db.types.createDefaultTypes(data.id);

		return createdObj.toJSON() as PadData;
	}

	async updatePadData(padId: PadId, data: PadDataUpdate): Promise<PadData> {
		const oldData = await this.getPadData(padId);

		if(!oldData)
			throw new Error("Pad " + padId + " could not be found.");

		if(data.id != null && data.id != padId && data.id.length == 0)
			throw new Error("Invalid read-only ID");

		if(data.id != null && data.id != padId) {
			if (await this.padIdExists(data.id))
				throw new Error("ID '" + data.id + "' is already taken.");
		}

		if(data.writeId != null && data.writeId != oldData.writeId) {
			if(data.writeId.length == 0)
				throw new Error("Invalid read-write ID");
			if(data.writeId == (data.id != null ? data.id : padId))
				throw new Error("Read-only and read-write ID cannot be the same.");

			if (await this.padIdExists(data.writeId))
				throw new Error("ID '" + data.writeId + "' is already taken.");
		}

		if(data.adminId != null && data.adminId != oldData.adminId) {
			if(data.adminId.length == 0)
				throw new Error("Invalid admin ID");
			if(data.adminId == (data.id != null ? data.id : padId))
				throw new Error("Read-only and admin ID cannot be the same.");
			if(data.adminId == (data.writeId != null ? data.writeId : oldData.writeId))
				throw new Error("Read-write and admin ID cannot be the same.");

			if (await this.padIdExists(data.adminId))
				throw new Error("ID '" + data.adminId + "' is already taken.");
		}

		await this.PadModel.update(data, { where: { id: padId } });

		const newData = await this.getPadData(data.id || padId);

		if (!newData)
			throw new Error("Pad has disappeared after updating.");

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
			throw new Error(`Pad "${padId}" does not exist.`);

		if (padData.defaultViewId) {
			await this.updatePadData(padData.id, { defaultViewId: null });
		}

		await streamEachPromise(this._db.markers.getPadMarkers(padData.id), async (marker) => {
			await this._db.markers.deleteMarker(padData.id, marker.id);
		});

		await streamEachPromise(this._db.lines.getPadLines(padData.id, ['id']), async (line) => {
			await this._db.lines.deleteLine(padData.id, line.id);
		});

		await streamEachPromise(this._db.types.getTypes(padData.id), async (type) => {
			await this._db.types.deleteType(padData.id, type.id);
		});

		await streamEachPromise(this._db.views.getViews(padData.id), async (view) => {
			await this._db.views.deleteView(padData.id, view.id);
		});

		await this._db.history.clearHistory(padData.id);

		await this.PadModel.destroy({ where: { id: padData.id } });

		this._db.emit("deletePad", padId);
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