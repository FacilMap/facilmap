import { type AssociationOptions, Model, type ModelAttributeColumnOptions, type ModelCtor, type WhereOptions, DataTypes, type FindOptions, Op, Sequelize, type ModelStatic } from "sequelize";
import type { Line, Marker, ID, Type, Bbox } from "facilmap-types";
import Database from "./database.js";
import { cloneDeep, isEqual } from "lodash-es";
import { iterableToAsync } from "../utils/streams";
import { getI18n } from "../i18n.js";
import { makePaginateLazy, type PaginateOptions } from "sequelize-cursor-pagination";

const ITEMS_PER_CREATE_BATCH = 5000;
const ITEMS_PER_READ_BATCH = 500;

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

export interface DataModel {
	id: ID;
	fieldId: string;
	value: string;
}

export const dataDefinition = {
	id: getDefaultIdType(),
	fieldId: { type: DataTypes.TEXT, allowNull: false },
	value: { type: DataTypes.TEXT, allowNull: false }
};

export function makeNotNullForeignKey(type: string, field: string, error = false): AssociationOptions {
	return {
		as: type,
		onUpdate: "CASCADE",
		onDelete: error ? "RESTRICT" : "CASCADE",
		foreignKey: { name: field, allowNull: false }
	}
}

export async function* findAllStreamed<ModelType extends Model>(
	model: ModelStatic<ModelType>,
	paginateOptions?: Omit<PaginateOptions<ModelType>, "after" | "limit">
): AsyncIterable<ModelType> {
	const paginate = makePaginateLazy(model);
	let cursor;
	while (true) {
		const result = paginate({
			...paginateOptions,
			after: cursor,
			limit: ITEMS_PER_READ_BATCH
		});

		const edges = await result.getEdges();

		if (edges.length === 0) {
			break;
		}

		for (const edge of edges) {
			yield edge.node;
		}

		cursor = edges[edges.length - 1].cursor;
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

	async _updateObjectStyles(objects: Marker | Line | AsyncIterable<Marker | Line>): Promise<void> {
		const types: Record<ID, Type> = { };
		for await (const object of Symbol.asyncIterator in objects ? objects : iterableToAsync([objects])) {
			const mapId = object.mapId;

			if(!types[object.typeId]) {
				types[object.typeId] = await this._db.types.getType(mapId, object.typeId);
				if(types[object.typeId] == null)
					throw new Error(getI18n().t("database.type-not-found-error", { typeId: object.typeId }));
			}

			const type = types[object.typeId];

			if (type.type === "line") {
				await this._db.lines._updateLine(object as Line, {}, type, { noHistory: true });
			} else {
				await this._db.markers._updateMarker(object as Marker, {}, type, { noHistory: true });
			}
		}
	}

	async _mapObjectExists(type: string, mapId: ID, id: ID): Promise<boolean> {
		const entry = await this._db._conn.model(type).findOne({
			where: { mapId, id: id },
			attributes: ['id']
		});
		return entry != null;
	}

	async _getMapObject<T>(type: "Marker" | "Line" | "Type" | "View" | "History", mapId: ID, id: ID, options?: { notFound404?: boolean }): Promise<T> {
		const includeData = [ "Marker", "Line" ].includes(type);

		const entry = await this._db._conn.model(type).findOne({
			where: { id: id, mapId },
			include: includeData ? [ this._db._conn.model(type + "Data") ] : [ ],
			nest: true
		});

		if(entry == null) {
			throw Object.assign(
				new Error(getI18n().t("database.object-not-found-in-map-error", { type, id, mapId })),
				options?.notFound404 ? { status: 404 } : {}
			);
		}

		const data: any = entry.toJSON();

		if(includeData) {
			data.data = this._dataFromArr((data as any)[type+"Data"]);
			delete (data as any)[type+"Data"];
		}

		return data;
	}

	async* _getMapObjects<T>(type: string, mapId: ID, condition?: FindOptions): AsyncIterable<T> {
		const includeData = [ "Marker", "Line" ].includes(type);

		if(includeData) {
			condition = condition || { };
			condition.include = [ ...(condition.include ? (Array.isArray(condition.include) ? condition.include : [ condition.include ]) : [ ]), this._db._conn.model(type + "Data") ];
		}

		for await (const obj of findAllStreamed(this._db._conn.model(type), {
			...condition,
			...includeData ? {
				include: [ ...(condition?.include ? (Array.isArray(condition.include) ? condition.include : [ condition.include ]) : [ ]), this._db._conn.model(type + "Data") ]
			} : {},
			where: {
				...condition?.where,
				mapId
			}
		})) {
			const d: any = obj.toJSON();

			if(includeData) {
				d.data = this._dataFromArr((d as any)[type+"Data"]);
				delete (d as any)[type+"Data"];
			}

			yield d;
		}
	}

	async _createMapObject<T>(type: string, mapId: ID, data: any): Promise<T> {
		const includeData = [ "Marker", "Line" ].includes(type);
		const makeHistory = [ "Marker", "Line", "View", "Type" ].includes(type);

		const obj = this._db._conn.model(type).build(data);
		(obj as any).mapId = mapId;

		const result: any = (await obj.save()).toJSON();

		if(includeData) {
			result.data = data.data || { };

			if(data.data != null)
				await this._setObjectData(type, result.id, data.data);
		}

		if(makeHistory)
			await this._db.history.addHistoryEntry(mapId, { type: type as any, action: "create", objectId: result.id, objectAfter: result });

		return result;
	}

	async _updateMapObject<T>(type: "Marker" | "Line" | "View" | "Type" | "History", mapId: ID, objId: ID, data: any, options?: { notFound404?: boolean; noHistory?: boolean }): Promise<T> {
		const includeData = [ "Marker", "Line" ].includes(type);
		const makeHistory = !options?.noHistory && [ "Marker", "Line", "View", "Type" ].includes(type);

		// Fetch the old object for the history, but also to make sure that the object exists. Unfortunately,
		// we cannot rely on the return value of the update() method, as on some platforms it returns 0 even
		// if the object was found (but no fields were changed)
		const oldObject = await this._getMapObject(type, mapId, objId, { notFound404: options?.notFound404 });

		if(Object.keys(data).length > 0 && (!includeData || !isEqual(Object.keys(data), ["data"])))
			await this._db._conn.model(type).update(data, { where: { id: objId, mapId } });

		const newObject: any = await this._getMapObject(type, mapId, objId);

		if(includeData) {
			if (data.data != null) {
				await this._setObjectData(type, objId, data.data);
				newObject.data = data.data;
			} else
				newObject.data = await this._getObjectData(type, objId);
		}

		if(makeHistory)
			await this._db.history.addHistoryEntry(mapId, { type: type as any, action: "update", objectId: objId, objectBefore: oldObject as any, objectAfter: newObject });

		return newObject;
	}

	async _deleteMapObject<T>(type: "Marker" | "Line" | "View" | "Type" | "History", mapId: ID, objId: ID, options?: { notFound404?: boolean }): Promise<T> {
		const includeData = [ "Marker", "Line" ].includes(type);
		const makeHistory = [ "Marker", "Line", "View", "Type" ].includes(type);

		const oldObject = await this._getMapObject<T>(type, mapId, objId, { notFound404: options?.notFound404 });

		if(includeData)
			await this._setObjectData(type, objId, { });

		await this._db._conn.model(type).build({ id: objId }).destroy();

		if(makeHistory)
			await this._db.history.addHistoryEntry(mapId, { type: type as any, action: "delete", objectId: objId, objectBefore: oldObject as any });

		return oldObject;
	}

	_dataToArr<T>(data: Record<string, string>, extend: T): Array<{ fieldId: string; value: string } & T> {
		const dataArr: Array<{ fieldId: string; value: string } & T> = [ ];
		for(const i of Object.keys(data)) {
			if(data[i] != null) {
				dataArr.push({ fieldId: i, value: data[i], ...extend });
			}
		}
		return dataArr;
	}

	_dataFromArr(dataArr: Array<{ fieldId: string; value: string }>): Record<string, string> {
		const data: Record<string, string> = Object.create(null);
		for(let i=0; i<dataArr.length; i++)
			data[dataArr[i].fieldId] = dataArr[i].value;
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

	async renameObjectDataValue(mapId: ID, typeId: ID, rename: Record<string, Record<string, string>>, isLine: boolean): Promise<void> {
		const objectStream = (isLine ? this._db.lines.getMapLinesByType(mapId, typeId) : this._db.markers.getMapMarkersByType(mapId, typeId));

		for await (const object of objectStream) {
			const newData = cloneDeep(object.data);

			for (const id of Object.keys(rename)) {
				for (const oldValue of Object.keys(rename[id])) {
					if (object.data[id] === oldValue) {
						newData[id] = rename[id][oldValue];
					}
				}
			}

			if (!isEqual(object.data, newData)) {
				if(isLine) {
					await this._db.lines.updateLine(object.mapId, object.id, { data: newData }, { noHistory: true });
				} else {
					await this._db.markers.updateMarker(object.mapId, object.id, { data: newData }, { noHistory: true });
				}
			}
		}
	}

	async _bulkCreateInBatches<T>(model: ModelCtor<Model>, data: Iterable<Record<string, unknown>> | AsyncIterable<Record<string, unknown>>): Promise<Array<T>> {
		const result: Array<any> = [];
		let slice: Array<Record<string, unknown>> = [];
		const createSlice = async () => {
			result.push(...(await model.bulkCreate(slice)).map((it) => it.toJSON()));
			slice = [];
		};

		for await (const item of data) {
			slice.push(item);
			if (slice.length >= ITEMS_PER_CREATE_BATCH) {
				await createSlice();
			}
		}
		if (slice.length > 0) {
			await createSlice();
		}
		return result;
	}

}
