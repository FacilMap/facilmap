var Promise = require("bluebird");
var Sequelize = require("sequelize");
var stream = require("stream");
var underscore = require("underscore");

var utils = require("../utils");

const Op = Sequelize.Op;

const ITEMS_PER_BATCH = 5000;

module.exports = function(Database) {
	utils.extend(Database.prototype, {
		_TYPES: {
			get lat() {
				return {
					type: Sequelize.FLOAT(9, 6),
					allowNull: false,
					validate: {
						min: -90,
						max: 90
					}
				}
			},

			get lon() {
				return {
					type: Sequelize.FLOAT(9, 6),
					allowNull: false,
					validate: {
						min: -180,
						max: 180
					}
				}
			},

			validateColour: { is: /^[a-fA-F0-9]{3}([a-fA-F0-9]{3})?$/ },

			dataDefinition: {
				"name" : { type: Sequelize.TEXT, allowNull: false },
				"value" : { type: Sequelize.TEXT, allowNull: false }
			}
		},

		_updateObjectStyles(objectStream, isLine) {
			var t = this;

			if(!(objectStream instanceof stream.Readable))
				objectStream = new utils.ArrayStream([ objectStream ]);

			var types = { };
			return utils.streamEachPromise(objectStream, (object) => {
				return Promise.resolve().then(() => {
					if(!types[object.typeId]) {
						return t.getType(object.padId, object.typeId).then((type) => {
							if(type == null)
								throw new Error("Type "+object.typeId+" does not exist.");

							return types[object.typeId] = type;
						});
					} else
						return types[object.typeId];
				}).then((type) => {
					var update = { };

					if(type.colourFixed && object.colour != type.defaultColour)
						update.colour = type.defaultColour;
					if(!isLine && type.sizeFixed && object.size != type.defaultSize)
						update.size = type.defaultSize;
					if(!isLine && type.symbolFixed && object.symbol != type.defaultSymbol)
						update.symbol = type.defaultSymbol;
					if(!isLine && type.shapeFixed && object.shape != type.defaultShape)
						update.shape = type.defaultShape;
					if(isLine && type.widthFixed && object.width != type.defaultWidth)
						update.width = type.defaultWidth;
					if(isLine && type.modeFixed && object.mode != "track" && object.mode != type.defaultMode)
						update.mode = type.defaultMode;

					types[object.typeId].fields.forEach((field) => {
						if((field.type == "dropdown" || field.type == "checkbox") && (field.controlColour || (!isLine && field.controlSize) || (!isLine && field.controlSymbol) || (!isLine && field.controlShape) || (isLine && field.controlWidth))) {
							if(!field.options)
								field.options = [];

							var _find = (value) => ((field.type == "dropdown" ? field.options.filter((option) => option.value == value)[0] : field.options[parseInt(value)]) || null);

							var option = _find(object.data[field.name]) || _find(field.default) || field.options[0];

							if(option != null) {
								if(field.controlColour && object.colour != option.colour)
									update.colour = option.colour;
								if(!isLine && field.controlSize && object.size != option.size)
									update.size = option.size;
								if(!isLine && field.controlSymbol && object.symbol != option.symbol)
									update.symbol = option.symbol;
								if(!isLine && field.controlShape && object.shape != option.shape)
									update.shape = option.shape;
								if(isLine && field.controlWidth && object.width != option.width)
									update.width = option.width;
							}
						}
					});

					var ret = [ ];

					if(Object.keys(update).length > 0) {
						utils.extend(object, update);

						if(object.id) // Objects from getLineTemplate() do not have an ID
							ret.push((isLine ? t.updateLine : t.updateMarker).call(t, object.padId, object.id, update, true));

						if(object.id && isLine && "mode" in update) {
							ret.push(t._calculateRouting(object).then(function(trackPoints) {
								return t._setLinePoints(object.padId, object.id, trackPoints);
							}));
						}
					}

					return Promise.all(ret);
				});
			});
		},

		_makeNotNullForeignKey(type, field, error) {
			return {
				as: type,
				onDelete: error ? "RESTRICT" : "CASCADE",
				foreignKey: { name: field, allowNull: false }
			}
		},

		_padObjectExists(type, padId, id) {
			return this._conn.model(type).count({ where: { padId: padId, id: id }, limit: 1 }).then(num => num > 0);
		},

		_getPadObject(type, padId, id) {
			var includeData = [ "Marker", "Line" ].includes(type);

			var cond = { where: { id: id, padId: padId }, include: includeData ? [ this._conn.model(type + "Data") ] : [ ] };
			return this._conn.model(type).findOne(cond).then(data => {
				if(data == null)
					throw new Error(type + " " + id + " of pad " + padId + " could not be found.");

				if(includeData) {
					data.data = this._dataFromArr(data[type+"Data"]);
					data.setDataValue("data", data.data); // For JSON.stringify()
					data.setDataValue(type+"Data", undefined);
				}

				return data;
			});
		},

		_getPadObjects(type, padId, condition) {
			var includeData = [ "Marker", "Line" ].includes(type);

			if(includeData) {
				condition = condition || { };
				condition.include = [ ...(condition.include || [ ]), this._conn.model(type + "Data") ];
			}

			var ret = new utils.ArrayStream();

			this._conn.model("Pad").build({ id: padId })["get" + this._conn.model(type).getTableName()](condition).then((objs) => {
				objs.forEach((it) => {
					if(includeData) {
						it.data = this._dataFromArr(it[type+"Data"]);
						it.setDataValue("data", it.data); // For JSON.stringify()
						it.setDataValue(type+"Data", undefined);
					}
				});

				ret.receiveArray(null, objs);
			}, (err) => {
				ret.receiveArray(err);
			});
			return ret;
		},

		_createPadObject(type, padId, data) {
			var includeData = [ "Marker", "Line" ].includes(type);
			var makeHistory = [ "Marker", "Line", "View", "Type" ].includes(type);

			return utils.promiseAuto({
				create: () => {
					var obj = this._conn.model(type).build(data);
					obj.padId = padId;
					return obj.save();
				},
				data: (create) => {
					if(includeData) {
						create.data = data.data || { };
						create.setDataValue("data", create.data); // For JSON.stringify()

						if(data.data != null)
							return this._setObjectData(type, create.id, data.data);
					}
				},
				history: (create, data) => {
					if(makeHistory)
						return this.addHistoryEntry(padId, { type: type, action: "create", objectId: create.id, objectAfter: create });
				}
			}).then(res => res.create);
		},

		_updatePadObject(type, padId, objId, data, _noHistory) {
			var includeData = [ "Marker", "Line" ].includes(type);
			var makeHistory = !_noHistory && [ "Marker", "Line", "View", "Type" ].includes(type);

			return utils.promiseAuto({
				oldData: () => {
					// Fetch the old object for the history, but also to make sure that the object exists. Unfortunately,
					// we cannot rely on the return value of the update() method, as on some platforms it returns 0 even
					// if the object was found (but no fields were changed)
					return this._getPadObject(type, padId, objId);
				},

				update: (oldData) => {
					if(!includeData || !underscore.isEqual(Object.keys(data), ["data"]))
						return this._conn.model(type).update(data, { where: { id: objId, padId: padId } });
				},

				newData: (update) => {
					return this._getPadObject(type, padId, objId);
				},

				updateData: (newData) => {
					if(includeData) {
						return (data.data != null ? this._setObjectData(type, objId, data.data) : this._getObjectData(type, objId)).then((dataData) => {
							newData.data = (data.data != null ? data.data : dataData);
							return newData.setDataValue("data", newData.data); // For JSON.stringify()
						});
					}
				},

				history: (oldData, newData, updateData) => {
					if(makeHistory)
						return this.addHistoryEntry(padId, { type: type, action: "update", objectId: objId, objectBefore: oldData, objectAfter: newData });
				}
			}).then(res => res.newData);
		},

		_deletePadObject(type, padId, objId) {
			var includeData = [ "Marker", "Line" ].includes(type);
			var makeHistory = [ "Marker", "Line", "View", "Type" ].includes(type);

			return utils.promiseAuto({
				oldData: () => {
					return this._getPadObject(type, padId, objId);
				},

				destroyData: (oldData) => {
					if(includeData)
						return this._setObjectData(type, objId, { });
				},

				destroy: (oldData, destroyData) => {
					return oldData.destroy();
				},

				history: (destroy, oldData) => {
					if(makeHistory)
						return this.addHistoryEntry(padId, { type: type, action: "delete", objectId: objId, objectBefore: oldData });
				}
			}).then(res => res.oldData);
		},

		_dataToArr(data, extend) {
			var dataArr = [ ];
			for(var i in data) {
				if(data[i] != null) {
					dataArr.push(utils.extend({ name: i, value: data[i] }, extend));
				}
			}
			return dataArr;
		},

		_dataFromArr(dataArr) {
			var data = { };
			for(var i=0; i<dataArr.length; i++)
				data[dataArr[i].name] = dataArr[i].value;
			return data;
		},

		_getObjectData(type, objId) {
			var filter = { };
			filter[type.toLowerCase()+"Id"] = objId;

			return this._conn.model(type+"Data").findAll({ where: filter}).then((dataArr) => {
				return this._dataFromArr(dataArr);
			});
		},

		_setObjectData(type, objId, data) {
			var model = this._conn.model(type+"Data");
			var idObj = { };
			idObj[type.toLowerCase()+"Id"] = objId;

			return model.destroy({ where: idObj}).then(() => {
				return model.bulkCreate(this._dataToArr(data, idObj));
			});
		},

		renameObjectDataField(padId, typeId, rename, isLine) {
			let objectStream = isLine ? this.getPadLinesByType(padId, typeId) : this.getPadMarkersByType(padId, typeId);

			return utils.streamEachPromise(objectStream, (object) => {
				let newData = underscore.clone(object.data);
				let newNames = [ ];

				for(let oldName in rename) {
					if(rename[oldName].name) {
						newData[rename[oldName].name] = object.data[oldName];
						newNames.push(oldName);
						if(!newNames.includes(oldName))
							delete newData[oldName];
					}

					for(let oldValue in (rename[oldName].values || { })) {
						if(object.data[oldName] == oldValue)
							newData[rename[oldName].name || oldName] = rename[oldName].values[oldValue];
					}
				}

				if(!underscore.isEqual(object.data, newData)) {
					if(isLine)
						return this.updateLine(object.padId, object.id, {data: newData}, true); // Last param true to not create history entry
					else
						return this.updateMarker(object.padId, object.id, {data: newData}, true); // Last param true to not create history entry
				}
			});
		},

		_makeBboxCondition(bbox, prefix) {
			if(!bbox)
				return { };

			prefix = prefix || "";

			var cond = (key, value) => {
				var ret = { };
				ret[prefix+key] = value;
				return ret;
			};

			var conditions = [ ];
			conditions.push(cond("lat", { [Op.lte]: bbox.top, [Op.gte]: bbox.bottom }));

			if(bbox.right < bbox.left) // Bbox spans over lon=180
				conditions.push(Sequelize.or(cond("lon", { [Op.gte]: bbox.left }), cond("lon", { [Op.lte]: bbox.right })));
			else
				conditions.push(cond("lon", { [Op.gte]: bbox.left, [Op.lte]: bbox.right }));

			if(bbox.except) {
				var exceptConditions = [ ];
				exceptConditions.push(Sequelize.or(cond("lat", { [Op.gt]: bbox.except.top }), cond("lat", { [Op.lt]: bbox.except.bottom })));

				if(bbox.except.right < bbox.except.left)
					exceptConditions.push(cond("lon", { [Op.lt]: bbox.except.left, [Op.gt]: bbox.except.right }));
				else
					exceptConditions.push(Sequelize.or(cond("lon", { [Op.lt]: bbox.except.left }), cond("lon", { [Op.gt]: bbox.except.right })));
				conditions.push(Sequelize.or.apply(Sequelize, exceptConditions));
			}

			return Sequelize.and.apply(Sequelize, conditions);
		},

		_bulkCreateInBatches(model, data) {
			let ret = Promise.resolve([]);
			for(let i=0; i<data.length; i+=ITEMS_PER_BATCH) {
				ret = ret.then((result) => {
					return model.bulkCreate(data.slice(i, i+ITEMS_PER_BATCH)).then((result2) => result.concat(result2));
				});
			}
			return ret;
		}
	});
};