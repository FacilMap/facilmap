var Sequelize = require("sequelize");

var utils = require("../utils");

module.exports = function(Database) {
	Database.prototype._init.push(function() {
		this._conn.define("Pad", {
			id : { type: Sequelize.STRING, allowNull: false, primaryKey: true, validate: { is: /^.+$/ } },
			name: { type: Sequelize.TEXT, allowNull: true, get: function() { return this.getDataValue("name") || "New FacilMap"; } },
			writeId: { type: Sequelize.STRING, allowNull: false, validate: { is: /^.+$/ } },
			searchEngines: { type: Sequelize.BOOLEAN, allowNull: false, default: false },
			description: { type: Sequelize.STRING, allowNull: false }
		});
	});

	Database.prototype._afterInit.push(function() {
		this._conn.model("Pad").belongsTo(this._conn.model("View"), { as: "defaultView", foreignKey: "defaultViewId", constraints: false });
	});

	// =====================================================================================================================

	utils.extend(Database.prototype, {
		padIdExists(padId) {
			return this._conn.model("Pad").count({ where: { $or: [ { id: padId }, { writeId: padId } ] } }).then(function(num) {
				return num > 0;
			});
		},

		getPadData(padId) {
			return this._conn.model("Pad").findOne({ where: { id: padId }, include: [ { model: this._conn.model("View"), as: "defaultView" } ]});
		},

		getPadDataByWriteId(writeId) {
			return this._conn.model("Pad").findOne({ where: { writeId: writeId }, include: [ { model: this._conn.model("View"), as: "defaultView" } ] });
		},

		createPad(data) {
			return utils.promiseAuto({
				validate: () => {
					if(!data.id || data.id.length == 0)
						throw "Invalid read-only ID";
					if(!data.writeId || data.writeId.length == 0)
						throw "Invalid write-only ID";
					if(data.id == data.writeId)
						throw "Read-only and write-only ID cannot be the same.";

					return Promise.all([
						this.padIdExists(data.id).then((exists) => {
							if(exists)
								throw "ID '" + data.id + "' is already taken.";
						}),
						this.padIdExists(data.writeId).then((exists) => {
							if(exists)
								throw "ID '" + data.writeId + "' is already taken.";
						})
					]);
				},

				create: (validate) => {
					return this._conn.model("Pad").create(data);
				},

				types: (create) => {
					return Promise.all(this.DEFAULT_TYPES.map((it) => {
						return this.createType(data.id, it);
					}));
				}
			}).then(res => {
				return res.create;
			});
		},

		updatePadData(padId, data) {
			return utils.promiseAuto({
				oldData: this.getPadData(padId),

				validateRead: () => {
					if(data.id != null && data.id != padId && data.id.length == 0)
						throw "Invalid read-only ID";

					var existsPromises = [ ];

					if(data.id != null && data.id != padId) {
						return this.padIdExists(data.id).then((exists) => {
							if(exists)
								throw "ID '" + data.id + "' is already taken.";
						});
					}
				},

				validateWrite: (oldData) => {
					if(data.writeId != null && data.writeId != oldData.writeId) {
						if(data.writeId.length == 0)
							throw "Invalid write-only ID";
						if(data.writeId == (data.id != null ? data.id : padId))
							throw "Read-only and write-only ID cannot be the same.";

						return this.padIdExists(data.writeId).then((exists) => {
							if(exists)
								throw "ID '" + data.writeId + "' is already taken.";
						});
					}
				},

				update: (validateRead, validateWrite) => {
					return this._conn.model("Pad").update(data, { where: { id: padId } }).then(res => {
						if(res[0] == 0)
							throw "Pad " + padId + " could not be found.";
						return res;
					});
				},

				newData: (update) => this.getPadData(data.id || padId),

				history: (oldData, newData) => {
					return this.addHistoryEntry(data.id || padId, {
						type: "Pad",
						action: "update",
						objectBefore: oldData,
						objectAfter: newData
					});
				}
			}).then((res) => {
				this.emit("padData", padId, res.newData);

				return res.newData;
			});
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
	});
};