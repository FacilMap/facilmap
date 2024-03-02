import { type AssociationOptions, Model, type ModelAttributeColumnOptions, type ModelCtor, type WhereOptions, DataTypes, type FindOptions, Op, Sequelize, type ModelStatic, type InferAttributes, type InferCreationAttributes, type CreationAttributes } from "sequelize";
import type { Line, Marker, PadId, ID, Type, Bbox } from "facilmap-types";
import Database from "./database.js";
import { cloneDeep, isEqual } from "lodash-es";
import { calculateRouteForLine } from "../routing/routing.js";
import type { PadModel } from "./pad";
import { arrayToAsyncIterator } from "../utils/streams";
import { applyLineStyles, applyMarkerStyles } from "facilmap-utils";

const ITEMS_PER_BATCH = 5000;

// Workaround for https://github.com/sequelize/sequelize/issues/15898
export function createModel<ModelInstance extends Model<any, any>>(): ModelStatic<ModelInstance> {
	return class extends Model {} as any;
}

export function getDefaultIdType(): ModelAttributeColumnOptions {
	return {
		type: DataTypes.INTEGER.UNSIGNED,
		autoIncrement: true,
		primaryKey: true
	};
}

export function getVirtualLatType(): ModelAttributeColumnOptions {
	return {
		type: DataTypes.VIRTUAL,
		get() {
			return this.getDataValue("pos")?.coordinates[1];
		},
		set(val: number) {
			const point = cloneDeep(this.getDataValue("pos")) ?? { type: "Point", coordinates: [0, 0] };
			point.coordinates[1] = val;
			this.setDataValue("pos", point);
		}
	};
}

export function getVirtualLonType(): ModelAttributeColumnOptions {
	return {
		type: DataTypes.VIRTUAL,
		get() {
			return this.getDataValue("pos")?.coordinates[0];
		},
		set(val: number) {
			const point = cloneDeep(this.getDataValue("pos")) ?? { type: "Point", coordinates: [0, 0] };
			point.coordinates[0] = val;
			this.setDataValue("pos", point);
		}
	};
}

export function getPosType(): ModelAttributeColumnOptions {
	return {
		type: DataTypes.GEOMETRY('POINT', 4326),
		allowNull: false,
		get() {
			return undefined;
		},
		set() {
			throw new Error('Cannot set pos directly.');
		}
	};
}

export function getLatType(): ModelAttributeColumnOptions {
	return {
		type: DataTypes.FLOAT(9, 6),
		allowNull: false,
		validate: {
			min: -90,
			max: 90
		}
	};
}

export function getLonType(): ModelAttributeColumnOptions {
	return {
		type: DataTypes.FLOAT(9, 6),
		allowNull: false,
		validate: {
			min: -180,
			max: 180
		}
	};
}

export interface DataModel extends Model<InferAttributes<DataModel>, InferCreationAttributes<DataModel>> {
	id: ID;
	name: string;
	value: string;
}

export const dataDefinition = {
	id: getDefaultIdType(),
	"name" : { type: DataTypes.TEXT, allowNull: false },
	"value" : { type: DataTypes.TEXT, allowNull: false }
};

export function makeNotNullForeignKey(type: string, field: string, error = false): AssociationOptions {
	return {
		as: type,
		onUpdate: "CASCADE",
		onDelete: error ? "RESTRICT" : "CASCADE",
		foreignKey: { name: field, allowNull: false }
	}
}

export interface BboxWithExcept extends Bbox {
	except?: Bbox;
}

export default class DatabaseHelpers {

	_db: Database;

	constructor(db: Database) {
		this._db = db;
	}

	async _updateObjectStyles(objects: Marker | Line | AsyncGenerator<Marker | Line, void, void>): Promise<void> {
		const types: Record<ID, Type> = { };
		for await (const object of Symbol.asyncIterator in objects ? objects : arrayToAsyncIterator([objects])) {
			const padId = object.padId;

			if(!types[object.typeId]) {
				types[object.typeId] = await this._db.types.getType(padId, object.typeId);
				if(types[object.typeId] == null)
					throw new Error("Type "+object.typeId+" does not exist.");
			}

			const type = types[object.typeId];
			const update = type.type === "marker" ? applyMarkerStyles(object as Marker, type) : applyLineStyles(object as Line, type);

			const actions: Array<Promise<any>> = [ ];

			if(Object.keys(update).length > 0) {
				Object.assign(object, update);

				if(object.id) { // Objects from getLineTemplate() do not have an ID
					if (type.type === "line") {
						actions.push(this._db.lines.updateLine(padId, object.id, update, true));
					} else {
						actions.push(this._db.markers.updateMarker(padId, object.id, update, true));
					}
				}

				if(object.id && type.type === "line" && "mode" in update) {
					actions.push(calculateRouteForLine(object as Line).then(async ({ trackPoints, ...routeInfo }) => {
						Object.assign(object, routeInfo);
						await this._db.lines._setLinePoints(padId, object.id, trackPoints);
					}));
				}
			}

			await Promise.all(actions);
		}
	}

	async _padObjectExists(type: string, padId: PadId, id: ID): Promise<boolean> {
		const entry = await this._db._conn.model(type).findOne({
			where: { padId: padId, id: id },
			attributes: ['id']
		});
		return entry != null;
	}

	async _getPadObject<T>(type: string, padId: PadId, id: ID): Promise<T> {
		const includeData = [ "Marker", "Line" ].includes(type);

		const entry = await this._db._conn.model(type).findOne({
			where: { id: id, padId: padId },
			include: includeData ? [ this._db._conn.model(type + "Data") ] : [ ],
			nest: true
		});

		if(entry == null)
			throw new Error(type + " " + id + " of pad " + padId + " could not be found.");

		const data: any = entry.toJSON();

		if(includeData) {
			data.data = this._dataFromArr((data as any)[type+"Data"]);
			delete (data as any)[type+"Data"];
		}

		return data;
	}

	async* _getPadObjects<T>(type: string, padId: PadId, condition?: FindOptions): AsyncGenerator<T, void, void> {
		const includeData = [ "Marker", "Line" ].includes(type);

		if(includeData) {
			condition = condition || { };
			condition.include = [ ...(condition.include ? (Array.isArray(condition.include) ? condition.include : [ condition.include ]) : [ ]), this._db._conn.model(type + "Data") ];
		}

		const Pad = this._db.pads.PadModel.build({ id: padId } satisfies Partial<CreationAttributes<PadModel>> as any);
		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		const objs: Array<Model> = await (Pad as any)["get" + this._db._conn.model(type).getTableName()](condition);

		for (const obj of objs) {
			const d: any = obj.toJSON();

			if(includeData) {
				d.data = this._dataFromArr((d as any)[type+"Data"]);
				delete (d as any)[type+"Data"];
			}

			yield d;
		}
	}

	async _createPadObject<T>(type: string, padId: PadId, data: any): Promise<T> {
		const includeData = [ "Marker", "Line" ].includes(type);
		const makeHistory = [ "Marker", "Line", "View", "Type" ].includes(type);

		const obj = this._db._conn.model(type).build(data);
		(obj as any).padId = padId;

		const result: any = (await obj.save()).toJSON();

		if(includeData) {
			result.data = data.data || { };

			if(data.data != null)
				await this._setObjectData(type, result.id, data.data);
		}

		if(makeHistory)
			await this._db.history.addHistoryEntry(padId, { type: type as any, action: "create", objectId: result.id, objectAfter: result });

		return result;
	}

	async _updatePadObject<T>(type: string, padId: PadId, objId: ID, data: any, _noHistory?: boolean): Promise<T> {
		const includeData = [ "Marker", "Line" ].includes(type);
		const makeHistory = !_noHistory && [ "Marker", "Line", "View", "Type" ].includes(type);

		// Fetch the old object for the history, but also to make sure that the object exists. Unfortunately,
		// we cannot rely on the return value of the update() method, as on some platforms it returns 0 even
		// if the object was found (but no fields were changed)
		const oldObject = await this._getPadObject(type, padId, objId);

		if(Object.keys(data).length > 0 && (!includeData || !isEqual(Object.keys(data), ["data"])))
			await this._db._conn.model(type).update(data, { where: { id: objId, padId: padId } });

		const newObject: any = await this._getPadObject(type, padId, objId);

		if(includeData) {
			if (data.data != null) {
				await this._setObjectData(type, objId, data.data);
				newObject.data = data.data;
			} else
				newObject.data = await this._getObjectData(type, objId);
		}

		if(makeHistory)
			await this._db.history.addHistoryEntry(padId, { type: type as any, action: "update", objectId: objId, objectBefore: oldObject as any, objectAfter: newObject });

		return newObject;
	}

	async _deletePadObject<T>(type: string, padId: PadId, objId: ID): Promise<T> {
		const includeData = [ "Marker", "Line" ].includes(type);
		const makeHistory = [ "Marker", "Line", "View", "Type" ].includes(type);

		const oldObject = await this._getPadObject<T>(type, padId, objId);

		if(includeData)
			await this._setObjectData(type, objId, { });

		await this._db._conn.model(type).build({ id: objId }).destroy();

		if(makeHistory)
			await this._db.history.addHistoryEntry(padId, { type: type as any, action: "delete", objectId: objId, objectBefore: oldObject as any });

		return oldObject;
	}

	_dataToArr<T>(data: Record<string, string>, extend: T): Array<{ name: string; value: string } & T> {
		const dataArr: Array<{ name: string; value: string } & T> = [ ];
		for(const i of Object.keys(data)) {
			if(data[i] != null) {
				dataArr.push({ name: i, value: data[i], ...extend });
			}
		}
		return dataArr;
	}

	_dataFromArr(dataArr: Array<{ name: string; value: string }>): Record<string, string> {
		const data: Record<string, string> = Object.create(null);
		for(let i=0; i<dataArr.length; i++)
			data[dataArr[i].name] = dataArr[i].value;
		return data;
	}

	async _getObjectData(type: string, objId: ID): Promise<Record<string, string>> {
		const filter: any = { };
		filter[type.toLowerCase()+"Id"] = objId;

		const dataArr = await this._db._conn.model(type+"Data").findAll({ where: filter });
		return this._dataFromArr(dataArr as any);
	}

	async _setObjectData(type: string, objId: ID, data: Record<string, string>): Promise<void> {
		const model = this._db._conn.model(type+"Data");
		const idObj: any = { };
		idObj[type.toLowerCase()+"Id"] = objId;

		await model.destroy({ where: idObj});
		await model.bulkCreate(this._dataToArr(data, idObj));
	}

	makeBboxCondition(bbox: BboxWithExcept | null | undefined, posField = "pos"): WhereOptions {
		const dbType  = this._db._conn.getDialect()
		if(!bbox)
			return { };

		const conditions = [ ];
		if(dbType == 'postgres') {
			conditions.push(
				Sequelize.where(
					Sequelize.fn("ST_MakeLine", Sequelize.fn("St_Point", bbox.left, bbox.bottom), Sequelize.fn("St_Point", bbox.right, bbox.top)),
					"~",
					Sequelize.col(posField))
			);
		} else {
			conditions.push(
				Sequelize.fn(
					"MBRContains",
					Sequelize.fn("LINESTRING", Sequelize.fn("POINT", bbox.left, bbox.bottom), Sequelize.fn("POINT", bbox.right, bbox.top)),
					Sequelize.col(posField)
				)
			);
		}

		if(bbox.except) {
			if(dbType == 'postgres') {
				conditions.push({
					[Op.not]: Sequelize.where(
							Sequelize.fn("St_MakeLine", Sequelize.fn("St_Point", bbox.except.left, bbox.except.bottom), Sequelize.fn("St_Point", bbox.except.right, bbox.except.top)),
							"~",
							Sequelize.col(posField)
					)
				});
			} else {
				conditions.push({
					[Op.not]: Sequelize.fn(
							"MBRContains",
							Sequelize.fn("LINESTRING", Sequelize.fn("POINT", bbox.except.left, bbox.except.bottom), Sequelize.fn("POINT", bbox.except.right, bbox.except.top)),
							Sequelize.col(posField)
					)
				});
			}
		}

		return {
			[Op.and]: conditions
		};
	}

	async renameObjectDataField(padId: PadId, typeId: ID, rename: Record<string, { name?: string; values?: Record<string, string> }>, isLine: boolean): Promise<void> {
		const objectStream = (isLine ? this._db.lines.getPadLinesByType(padId, typeId) : this._db.markers.getPadMarkersByType(padId, typeId));

		for await (const object of objectStream) {
			const newData = cloneDeep(object.data);
			const newNames: string[] = [ ];

			for(const oldName in rename) {
				if(rename[oldName].name) {
					newData[rename[oldName].name!] = object.data[oldName];
					newNames.push(rename[oldName].name!);
					if(!newNames.includes(oldName))
						delete newData[oldName];
				}

				for(const oldValue in (rename[oldName].values || { })) {
					if(object.data[oldName] == oldValue)
						newData[rename[oldName].name || oldName] = rename[oldName].values![oldValue];
				}
			}

			if(!isEqual(object.data, newData)) {
				if(isLine)
					await this._db.lines.updateLine(object.padId, object.id, { data: newData }, true); // Last param true to not create history entry
				else
					await this._db.markers.updateMarker(object.padId, object.id, { data: newData }, true); // Last param true to not create history entry
			}
		}
	}

	async _bulkCreateInBatches<T>(model: ModelCtor<Model>, data: Array<Record<string, unknown>>): Promise<Array<T>> {
		const result: Array<any> = [];
		for(let i=0; i<data.length; i+=ITEMS_PER_BATCH)
			result.push(...(await model.bulkCreate(data.slice(i, i+ITEMS_PER_BATCH))).map((it) => it.toJSON()));
		return result;
	}

}
