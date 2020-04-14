import highland from "highland";
import { streamEachPromise } from "../utils/streams";
import { clone, promiseAuto } from "../utils/utils";
import { AssociationOptions } from "sequelize/types/lib/associations/base";
import { Line, Marker, PadId } from "facilmap-types";
import Database from "./database";
import { DataTypes, FindOptions, Op, Sequelize } from "sequelize";
import { Readable } from "stream";
import { isEqual } from "underscore";
import { Field, FieldBase, fieldHasOptions, FieldOptions, GenericType, ID, LineField, LineUpdate, MarkerField, MarkerUpdate, Type } from "../../../types/src";
import { LineType, MarkerType } from "../../../types/src/type";

const ITEMS_PER_BATCH = 5000;

export function getLatType() {
	return {
		type: DataTypes.FLOAT(9, 6),
		allowNull: false,
		validate: {
			min: -90,
			max: 90
		}
	};
}

export function getLonType() {
	return {
		type: DataTypes.FLOAT(9, 6),
		allowNull: false,
		validate: {
			min: -180,
			max: 180
		}
	};
}

export const validateColour = { is: /^[a-fA-F0-9]{3}([a-fA-F0-9]{3})?$/ };

export const dataDefinition = {
	"name" : { type: DataTypes.TEXT, allowNull: false },
	"value" : { type: DataTypes.TEXT, allowNull: false }
};

export default class DatabaseHelpers {

	_db: Database;

	constructor(db: Database) {
		this._db = db;
	}

	async _updateObjectStyles(objectStream: Marker | Line | Highland.Stream<Marker | Line>): Promise<void> {
		const stream = (highland.isStream(objectStream) ? highland(objectStream) : highland([ objectStream ])) as Highland.Stream<Marker | Line>;

		type MarkerData = { object: Marker; type: MarkerType; update: MarkerUpdate; };
		type LineData = { object: Line; type: LineType; update: LineUpdate; };
		const isLine = (data: MarkerData | LineData): data is LineData => (data.type.type == "line");

		const types = { } as Record<ID, Type>;
		await streamEachPromise(stream, async (object: Marker | Line) => {
			if(!types[object.typeId]) {
				types[object.typeId] = await this.types.getType(object.padId, object.typeId);
				if(types[object.typeId] == null)
					throw new Error("Type "+object.typeId+" does not exist.");
			}

			let data = {
				object,
				type: types[object.typeId],
				update: { } as MarkerUpdate | LineUpdate
			} as MarkerData | LineData;

			if(data.type.colourFixed && data.type.defaultColour && object.colour != data.type.defaultColour)
				data.update.colour = type.defaultColour;

			if(!isLine(data)) {
				if(data.type.sizeFixed && data.object.size != data.type.defaultSize)
					data.update.size = data.type.defaultSize!;
				if(data.type.symbolFixed && data.object.symbol != data.type.defaultSymbol)
					data.update.symbol = data.type.defaultSymbol!;
				if(data.type.shapeFixed && data.object.shape != data.type.defaultShape)
					data.update.shape = data.type.defaultShape!;
			} else {
				if(data.type.widthFixed && data.object.width != data.type.defaultWidth)
					data.update.width = data.type.defaultWidth!;
				if(data.type.modeFixed && data.object.mode != "track" && data.object.mode != type.defaultMode)
					data.update.mode = data.type.defaultMode!;
			}

			for(const field of data.type.fields) {
				const thisData = data.type
				if(fieldHasOptions(field) && (field.controlColour || (!isLine(data) ? (field.controlSize || field.controlSymbol || field.controlShape) : field.controlWidth))) {
					let options = (field.options || []) as FieldOptions;

					const _find = (value: string) => ((field.type == "dropdown" ? options.filter((option) => option.value == value)[0] : field.options[parseInt(value)]) || null);

					const option = _find(object.data[field.name]) || _find(field.default) || field.options[0];

					if(option != null) {
						if(field.controlColour && object.colour != option.colour)
							update.colour = option.colour;
						if(!isLineObject(object) && !isLineUpdate(update) && !isLineField(field))
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
			}

			const ret = [ ];

			if(Object.keys(update).length > 0) {
				Object.assign(object, update);

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
	}

	_makeNotNullForeignKey(type: string, field: string, error: boolean = false): AssociationOptions {
		return {
			as: type,
			onDelete: error ? "RESTRICT" : "CASCADE",
			foreignKey: { name: field, allowNull: false }
		}
	}

	_padObjectExists(type, padId, id) {
		return this._db._conn.model(type).count({ where: { padId: padId, id: id }, limit: 1 }).then(num => num > 0);
	}

	_getPadObject(type, padId, id) {
		const includeData = [ "Marker", "Line" ].includes(type);

		const cond = { where: { id: id, padId: padId }, include: includeData ? [ this._db._conn.model(type + "Data") ] : [ ] };
		return this._db._conn.model(type).findOne(cond).then(data => {
			if(data == null)
				throw new Error(type + " " + id + " of pad " + padId + " could not be found.");

			if(includeData) {
				data.data = this._dataFromArr(data[type+"Data"]);
				data.setDataValue("data", data.data); // For JSON.stringify()
				data.setDataValue(type+"Data", undefined);
			}

			return data;
		});
	}

	_getPadObjects(type: string, padId: PadId, condition: FindOptions) {
		const includeData = [ "Marker", "Line" ].includes(type);

		if(includeData) {
			condition = condition || { };
			condition.include = [ ...(condition.include || [ ]), this._db._conn.model(type + "Data") ];
		}

		return highland(this._db._conn.model("Pad").build({ id: padId })["get" + this._db._conn.model(type).getTableName()](condition))
			.flatMap((objs) => {
				objs.forEach((it) => {
					if(includeData) {
						it.data = this._dataFromArr(it[type+"Data"]);
						it.setDataValue("data", it.data); // For JSON.stringify()
						it.setDataValue(type+"Data", undefined);
					}
				});

				return highland(objs);
			})
			.toNodeStream({ objectMode: true });
	}

	_createPadObject(type, padId, data) {
		const includeData = [ "Marker", "Line" ].includes(type);
		const makeHistory = [ "Marker", "Line", "View", "Type" ].includes(type);

		return promiseAuto({
			create: () => {
				const obj = this._db._conn.model(type).build(data);
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
	}

	_updatePadObject(type, padId, objId, data, _noHistory) {
		const includeData = [ "Marker", "Line" ].includes(type);
		const makeHistory = !_noHistory && [ "Marker", "Line", "View", "Type" ].includes(type);

		return promiseAuto({
			oldData: () => {
				// Fetch the old object for the history, but also to make sure that the object exists. Unfortunately,
				// we cannot rely on the return value of the update() method, as on some platforms it returns 0 even
				// if the object was found (but no fields were changed)
				return this._getPadObject(type, padId, objId);
			},

			update: (oldData) => {
				if(Object.keys(data).length > 0 && (!includeData || !isEqual(Object.keys(data), ["data"])))
					return this._db._conn.model(type).update(data, { where: { id: objId, padId: padId } });
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
	}

	_deletePadObject(type, padId, objId) {
		const includeData = [ "Marker", "Line" ].includes(type);
		const makeHistory = [ "Marker", "Line", "View", "Type" ].includes(type);

		return promiseAuto({
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
	}

	_dataToArr(data, extend) {
		const dataArr = [ ];
		for(const i in data) {
			if(data[i] != null) {
				dataArr.push({ name: i, value: data[i], ...extend });
			}
		}
		return dataArr;
	}

	_dataFromArr(dataArr) {
		const data = { };
		for(const i=0; i<dataArr.length; i++)
			data[dataArr[i].name] = dataArr[i].value;
		return data;
	}

	_getObjectData(type, objId) {
		const filter = { };
		filter[type.toLowerCase()+"Id"] = objId;

		return this._db._conn.model(type+"Data").findAll({ where: filter}).then((dataArr) => {
			return this._dataFromArr(dataArr);
		});
	}

	_setObjectData(type, objId, data) {
		const model = this._db._conn.model(type+"Data");
		const idObj = { };
		idObj[type.toLowerCase()+"Id"] = objId;

		return model.destroy({ where: idObj}).then(() => {
			return model.bulkCreate(this._dataToArr(data, idObj));
		});
	}

	renameObjectDataField(padId, typeId, rename, isLine) {
		let objectStream = isLine ? this.getPadLinesByType(padId, typeId) : this.getPadMarkersByType(padId, typeId);

		return streamEachPromise(objectStream, (object) => {
			let newData = clone(object.data);
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
	}

	_makeBboxCondition(bbox, prefix) {
		if(!bbox)
			return { };

		prefix = prefix || "";

		const cond = (key, value) => {
			const ret = { };
			ret[prefix+key] = value;
			return ret;
		};

		const conditions = [ ];
		conditions.push(cond("lat", { [Op.lte]: bbox.top, [Op.gte]: bbox.bottom }));

		if(bbox.right < bbox.left) // Bbox spans over lon=180
			conditions.push(Sequelize.or(cond("lon", { [Op.gte]: bbox.left }), cond("lon", { [Op.lte]: bbox.right })));
		else
			conditions.push(cond("lon", { [Op.gte]: bbox.left, [Op.lte]: bbox.right }));

		if(bbox.except) {
			const exceptConditions = [ ];
			exceptConditions.push(Sequelize.or(cond("lat", { [Op.gt]: bbox.except.top }), cond("lat", { [Op.lt]: bbox.except.bottom })));

			if(bbox.except.right < bbox.except.left)
				exceptConditions.push(cond("lon", { [Op.lt]: bbox.except.left, [Op.gt]: bbox.except.right }));
			else
				exceptConditions.push(Sequelize.or(cond("lon", { [Op.lt]: bbox.except.left }), cond("lon", { [Op.gt]: bbox.except.right })));
			conditions.push(Sequelize.or.apply(Sequelize, exceptConditions));
		}

		return Sequelize.and.apply(Sequelize, conditions);
	}

	_bulkCreateInBatches(model, data) {
		let ret = Promise.resolve([]);
		for(let i=0; i<data.length; i+=ITEMS_PER_BATCH) {
			ret = ret.then((result) => {
				return model.bulkCreate(data.slice(i, i+ITEMS_PER_BATCH)).then((result2) => result.concat(result2));
			});
		}
		return ret;
	}

};
