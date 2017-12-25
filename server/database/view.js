var Sequelize = require("sequelize");

var utils = require("../utils");

module.exports = function(Database) {
	Database.prototype._init.push(function() {
		this._conn.define("View", {
			name : { type: Sequelize.TEXT, allowNull: false },
			baseLayer : { type: Sequelize.TEXT, allowNull: false },
			layers : {
				type: Sequelize.TEXT,
				allowNull: false,
				get: function() {
					return JSON.parse(this.getDataValue("layers"));
				},
				set: function(v) {
					this.setDataValue("layers", JSON.stringify(v));
				}
			},
			top : this._TYPES.lat,
			bottom : this._TYPES.lat,
			left : this._TYPES.lon,
			right : this._TYPES.lon,
			filter: { type: Sequelize.TEXT, allowNull: true }
		});
	});

	Database.prototype._afterInit.push(function() {
		this._conn.model("View").belongsTo(this._conn.model("Pad"), this._makeNotNullForeignKey("pad", "padId"));
		this._conn.model("Pad").hasMany(this._conn.model("View"), { foreignKey: "padId" });
	});

	// =====================================================================================================================

	utils.extend(Database.prototype, {
		getViews(padId) {
			return this._getPadObjects("View", padId);
		},

		createView(padId, data) {
			return utils.promiseAuto({
				create: () => {
					if(data.name == null || data.name.trim().length == 0)
						throw new Error("No name provided.");

					return this._createPadObject("View", padId, data);
				},

				/*history: (create) => {
					return this.addHistoryEntry(padId, {
						type: "view",
						action: "create"
					});
				}*/
			}).then((res) => {
				this.emit("view", padId, res.create);

				return res.create;
			});
		},

		updateView(padId, viewId, data) {
			return this._updatePadObject("View", padId, viewId, data).then((newData) => {
				this.emit("view", padId, newData);

				return newData;
			});
		},

		deleteView(padId, viewId) {
			return this._deletePadObject("View", padId, viewId).then((data) => {
				this.emit("deleteView", padId, { id: data.id });

				return data;
			});
		}
	});
};