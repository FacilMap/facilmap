var Promise = require("bluebird");
var Sequelize = require("sequelize");

var utils = require("../utils");

module.exports = function(Database) {
	Database.prototype._init.push(function() {
		var Type = this._conn.define("Type", {
			name: { type: Sequelize.TEXT, allowNull: false },
			type: { type: Sequelize.ENUM("marker", "line"), allowNull: false },
			defaultColour: { type: Sequelize.STRING(6), allowNull: true, validate: this._TYPES.validateColour },
			colourFixed: { type: Sequelize.BOOLEAN, allowNull: true },
			defaultSize: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, validate: { min: 15 } },
			sizeFixed: { type: Sequelize.BOOLEAN, allowNull: true },
			defaultSymbol: { type: Sequelize.TEXT, allowNull: true},
			symbolFixed: { type: Sequelize.BOOLEAN, allowNull: true},
			defaultShape: { type: Sequelize.TEXT, allowNull: true },
			shapeFixed: { type: Sequelize.BOOLEAN, allowNull: true },
			defaultWidth: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, validate: { min: 1 } },
			widthFixed: { type: Sequelize.BOOLEAN, allowNull: true },
			defaultMode: { type: Sequelize.ENUM("", "car", "bicycle", "pedestrian", "track"), allowNull: true },
			modeFixed: { type: Sequelize.BOOLEAN, allowNull: true },

			fields: {
				type: Sequelize.TEXT,
				allowNull: false,
				get: function() {
					return JSON.parse(this.getDataValue("fields"));
				},
				set: function(v) {
					for(let field of v) {
						if(field.controlSymbol) {
							for(let option of field.options) {
								if(!option.symbol)
									option.symbol = ""; // Avoid "undefined" ending up there, which messes everything up
							}
						}
						if(field.controlShape) {
							for(let option of field.options) {
								if(!option.shape)
									option.shape = ""; // Avoid "undefined" ending up there, which messes everything up
							}
						}
					}

					return this.setDataValue("fields", JSON.stringify(v));
				},
				validate: {
					checkUniqueFieldName: (obj) => {
						obj = JSON.parse(obj);
						var fields = { };
						for(var i=0; i<obj.length; i++) {
							if(obj[i].name.trim().length == 0)
								throw new Error("Empty field name.");
							if(fields[obj[i].name])
								throw new Error("field name "+obj[i].name+" is not unique.");
							fields[obj[i].name] = true;
							if([ "textarea", "dropdown", "checkbox", "input" ].indexOf(obj[i].type) == -1)
								throw new Error("Invalid field type "+obj[i].type+" for field "+obj[i].name+".");
							if(obj[i].controlColour) {
								if(!obj[i].options || obj[i].options.length < 1)
									throw new Error("No options specified for colour-controlling field "+obj[i].name+".");
								for(var j=0; j<obj[i].options.length; j++) {
									if(!obj[i].options[j].colour || !obj[i].options[j].colour.match(this._TYPES.validateColour.is))
										throw new Error("Invalid colour "+obj[i].options[j].colour+" in field "+obj[i].name+".");
								}
							}
							if(obj[i].controlSize) {
								if(!obj[i].options || obj[i].options.length < 1)
									throw new Error("No options specified for size-controlling field "+obj[i].name+".");
								for(var j=0; j<obj[i].options.length; j++) {
									if(!obj[i].options[j].size || !isFinite(obj[i].options[j].size) || obj[i].options[j].size < 15)
										throw new Error("Invalid size "+obj[i].options[j].size+" in field "+obj[i].name+".");
								}
							}
							if(obj[i].controlSymbol) {
								if(!obj[i].options || obj[i].options.length < 1)
									throw new Error("No options specified for icon-controlling field "+obj[i].name+".");
							}
							if(obj[i].controlWidth) {
								if(!obj[i].options || obj[i].options.length < 1)
									throw new Error("No options specified for width-controlling field "+obj[i].name+".");
								for(var j=0; j<obj[i].options.length; j++) {
									if(!obj[i].options[j].width || !(1*obj[i].options[j].width >= 1))
										throw new Error("Invalid width "+obj[i].options[j].width+" in field "+obj[i].name+".");
								}
							}

							// Validate unique dropdown entries
							if(obj[i].type == "dropdown") {
								let existingValues = { };
								for(let option of (obj[i].options || [])) {
									if(existingValues[option.value])
										throw new Error(`Duplicate option "${option.value}" for field "${obj[i].name}".`);
									existingValues[option.value] = true;
								}
							}
						}
					}
				}
			}
		}, {
			validate: {
				defaultValsNotNull: function() {
					if(this.colourFixed && this.defaultColour == null)
						throw "Fixed colour cannot be undefined.";
					if(this.sizeFixed && this.defaultSize == null)
						throw "Fixed size cannot be undefined.";
					if(this.widthFixed && this.defaultWidth == null)
						throw "Fixed width cannot be undefined.";
				}
			}
		});
	});

	Database.prototype._afterInit.push(function() {
		this._conn.model("Type").belongsTo(this._conn.model("Pad"), this._makeNotNullForeignKey("pad", "padId"));
		this._conn.model("Pad").hasMany(this._conn.model("Type"), { foreignKey: "padId" });
	});

	// =====================================================================================================================

	utils.extend(Database.prototype, {
		DEFAULT_TYPES: [
			{ name: "Marker", type: "marker", fields: [ { name: "Description", type: "textarea" } ] },
			{ name: "Line", type: "line", fields: [ { name: "Description", type: "textarea" } ] }
		],

		getTypes(padId) {
			return this._getPadObjects("Type", padId);
		},

		getType(padId, typeId) {
			return this._getPadObject("Type", padId, typeId);
		},

		createType(padId, data) {
			return Promise.resolve().then(() => {
				if(data.name == null || data.name.trim().length == 0)
					throw "No name provided.";

				return this._createPadObject("Type", padId, data);
			}).then((data) => {
				this.emit("type", data.padId, data);

				return data;
			});
		},

		updateType(padId, typeId, data, _doNotUpdateStyles) {
			return Promise.resolve().then(() => {
				if(data.name == null || data.name.trim().length == 0)
					throw "No name provided.";

				return this._updatePadObject("Type", padId, typeId, data);
			}).then((data) => {
				this.emit("type", data.padId, data);

				if(!_doNotUpdateStyles)
					return this.recalculateObjectStylesForType(data.padId, typeId, data.type == "line").then(() => data);
			});
		},

		recalculateObjectStylesForType(padId, typeId, isLine) {
			return this._updateObjectStyles(isLine ? this.getPadLinesByType(padId, typeId) : this.getPadMarkersByType(padId, typeId), isLine);
		},

		_optionsToObj(options, idx) {
			var ret = { };
			if(options) {
				for(var i=0; i<options.length; i++) {
					ret[options[i].key] = options[i][idx];
				}
			}
			return ret;
		},

		isTypeUsed(padId, typeId) {
			return Promise.all([
				this._conn.model("Marker").findOne({ where: { padId: padId, typeId: typeId } }),
				this._conn.model("Line").findOne({ where: { padId: padId, typeId: typeId } })
			]).then(res => {
				return !!res[0] || !!res[1];
			});
		},

		deleteType(padId, typeId) {
			return utils.promiseAuto({
				isUsed: this.isTypeUsed(padId, typeId),
				del: (isUsed) => {
					if(isUsed)
						throw "This type is in use.";

					return this._deletePadObject("Type", padId, typeId);
				}
			}).then((res) => {
				this.emit("deleteType", padId, { id: res.del.id });

				return res.del;
			});
		}
	});
};