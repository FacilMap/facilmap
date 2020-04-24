var Sequelize = require("sequelize");

var utils = require("../utils");

module.exports = function(Database) {
	Database.prototype._init.push(function() {
		this._conn.define("History", {
			time: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
			type: { type: Sequelize.ENUM("Marker", "Line", "View", "Type", "Pad"), allowNull: false },
			action: { type: Sequelize.ENUM("create", "update", "delete"), allowNull: false },
			objectId: { type: Sequelize.INTEGER(), allowNull: true }, // Is null when type is pad
			objectBefore: {
				type: Sequelize.TEXT,
				allowNull: true,
				get: function() {
					var obj = this.getDataValue("objectBefore");
					return obj == null ? null : JSON.parse(obj);
				},
				set: function(v) {
					this.setDataValue("objectBefore", v == null ? null : JSON.stringify(v));
				}
			},
			objectAfter: {
				type: Sequelize.TEXT,
				allowNull: true,
				get: function() {
					var obj = this.getDataValue("objectAfter");
					return obj == null ? null : JSON.parse(obj);
				},
				set: function(v) {
					this.setDataValue("objectAfter", v == null ? null : JSON.stringify(v));
				}
			}
		}, {
			freezeTableName: true // Do not call it Histories
		});
	});

	Database.prototype._afterInit.push(function() {
		this._conn.model("Pad").hasMany(this._conn.model("History"), this._makeNotNullForeignKey("History", "padId"));
		this._conn.model("History").belongsTo(this._conn.model("Pad"), this._makeNotNullForeignKey("pad", "padId"));
	});


	// =====================================================================================================================


	utils.extend(Database.prototype, {
		HISTORY_ENTRIES: 50,

		addHistoryEntry(padId, data) {
			return utils.promiseAuto({
				oldEntryIds: () => {
					return this._conn.model("History").findAll({
						where: { padId: padId },
						order: [[ "time", "DESC" ]],
						offset: this.HISTORY_ENTRIES-1,
						attributes: [ "id" ]
					}).then(ids => ids.map(it => it.id));
				},
				destroyOld: (oldEntryIds) => {
					if(oldEntryIds && oldEntryIds.length > 0) {
						return this._conn.model("History").destroy({ where: { padId: padId, id: oldEntryIds } });
					}
				},
				addEntry: (oldEntryIds) => {
					var dataClone = JSON.parse(JSON.stringify(data));
					if(data.type != "Pad") {
						if(dataClone.objectBefore) {
							delete dataClone.objectBefore.id;
							delete dataClone.objectBefore.padId;
						}
						if(dataClone.objectAfter) {
							delete dataClone.objectAfter.id;
							delete dataClone.objectAfter.padId;
						}
					}

					return this._createPadObject("History", padId, dataClone);
				}
			}).then(res => {
				this.emit("addHistoryEntry", padId, res.addEntry);

				return res.addEntry;
			});
		},

		getHistory(padId, types) {
			let query = { order: [[ "time", "DESC" ]] };
			if(types)
				query.where = {type: types};
			return this._getPadObjects("History", padId, query);
		},

		getHistoryEntry(padId, entryId) {
			return this._getPadObject("History", padId, entryId);
		},

		revertHistoryEntry(padId, id) {
			return this.getHistoryEntry(padId, id).then((entry) => {
				if(entry.type == "Pad")
					return this.updatePadData(padId, entry.objectBefore);

				return utils.promiseAuto({
					existsNow: () => {
						return this._padObjectExists(entry.type, padId, entry.objectId);
					},

					restore: (existsNow) => {
						var objectBefore = JSON.parse(JSON.stringify(entry.objectBefore));

						if(entry.action == "create")
							return existsNow && this["delete" + entry.type].call(this, padId, entry.objectId, objectBefore);
						else if(existsNow)
							return this["update" + entry.type].call(this, padId, entry.objectId, objectBefore);
						else {
							return this["create" + entry.type].call(this, padId, objectBefore).then((newObj) => {
								return this._conn.model("History").update({ objectId: newObj.id }, { where: { padId: padId, type: entry.type, objectId: entry.objectId } }).then(() => {
									this.emit("historyChange", padId);
								});
							});
						}
					}
				}).then(res => null);
			});
		},

		async clearHistory(padId) {
			await this._conn.model("History").destroy({ where: { padId: padId } });
		}
	});
};