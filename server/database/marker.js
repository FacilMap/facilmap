var Sequelize = require("sequelize");

var utils = require("../utils");

module.exports = function(Database) {
	Database.prototype._init.push(function() {
		this._conn.define("Marker", {
			"lat" : this._TYPES.lat,
			"lon" : this._TYPES.lon,
			name : { type: Sequelize.TEXT, allowNull: true, get: function() { return this.getDataValue("name") || "Untitled marker"; } },
			colour : { type: Sequelize.STRING(6), allowNull: false, defaultValue: "ff0000", validate: this._TYPES.validateColour },
			size : { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 25, validate: { min: 15 } },
			symbol : { type: Sequelize.TEXT, allowNull: true }
		});

		this._conn.define("MarkerData", this._TYPES.dataDefinition);
	});

	Database.prototype._afterInit.push(function() {
		var Marker = this._conn.model("Marker");
		this._conn.model("Pad").hasMany(Marker, this._makeNotNullForeignKey("Markers", "padId"));
		Marker.belongsTo(this._conn.model("Pad"), this._makeNotNullForeignKey("pad", "padId"));
		Marker.belongsTo(this._conn.model("Type"), this._makeNotNullForeignKey("type", "typeId", true));

		this._conn.model("MarkerData").belongsTo(Marker, this._makeNotNullForeignKey("marker", "markerId"));
		Marker.hasMany(this._conn.model("MarkerData"), { foreignKey: "markerId" });
	});

	// =====================================================================================================================

	utils.extend(Database.prototype, {
		getPadMarkers(padId, bbox) {
			return this._getPadObjects("Marker", padId, { where: this._makeBboxCondition(bbox) });
		},

		getPadMarkersByType(padId, typeId) {
			return this._getPadObjects("Marker", padId, { where: { padId: padId, typeId: typeId } });
		},

		createMarker(padId, data) {
			return utils.promiseAuto({
				type: this.getType(padId, data.typeId),
				create: (type) => {
					if(type.defaultColour)
						data.colour = type.defaultColour;
					if(type.defaultSize)
						data.size = type.defaultSize;
					if(type.defaultSymbol)
						data.symbol = type.defaultSymbol;

					return this._createPadObject("Marker", padId, data);
				},
				styles: (create) => {
					return this._updateObjectStyles(create, false)
				}
			}).then((res) => {
				this.emit("marker", padId, res.create);

				return res.create;
			});
		},

		updateMarker(padId, markerId, data, doNotUpdateStyles) {
			return utils.promiseAuto({
				update: this._updatePadObject("Marker", padId, markerId, data, doNotUpdateStyles),
				updateStyles: (update) => {
					if(!doNotUpdateStyles)
						return this._updateObjectStyles(update, false);
				}
			}).then((res) => {
				this.emit("marker", padId, res.update);

				return res.update;
			});
		},

		deleteMarker(padId, markerId) {
			return this._deletePadObject("Marker", padId, markerId).then(del => {
				this.emit("deleteMarker", padId, { id: del.id });

				return del;
			});
		}
	});
};