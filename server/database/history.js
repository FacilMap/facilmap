var Sequelize = require("sequelize");

var utils = require("../utils");

module.exports = function(Database) {
	Database.prototype._init.push(function() {
		this._conn.define("History", {
			time: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
			type: { type: Sequelize.ENUM("marker", "line", "view", "type", "pad"), allowNull: false },
			action: { type: Sequelize.ENUM("create", "update", "delete"), allowNull: false },
			objectBefore: {
				type: Sequelize.TEXT,
				allowNull: true,
				get: function() {
					return JSON.parse(this.getDataValue("objectBefore"));
				},
				set: function(v) {
					this.setDataValue("objectBefore", JSON.stringify(v));
				}
			}
		});
	});

	Database.prototype._afterInit.push(function() {
		this._conn.model("Pad").hasMany(this._conn.model("History"), this._makeNotNullForeignKey("History", "padId"));
		this._conn.model("History").belongsTo(this._conn.model("Pad"), this._makeNotNullForeignKey("pad", "padId"));
	});


	// =====================================================================================================================


	utils.extend(Database.prototype, {
		addHistoryEntry(padId, data) {
			return this._createPadObject("History", padId, data).then((historyEntry) => {
				this.emit("addHistoryEntry", historyEntry);
			});
		},

		getHistory(padId) {
			return this._getPadObjects("History", padId);
		}
	});
};