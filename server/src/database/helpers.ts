import highland from "highland";
import { streamEachPromise } from "../utils/streams";
import { clone } from "../utils/utils";
import { AssociationOptions, Model, ModelAttributeColumnOptions, ModelCtor, WhereOptions } from "sequelize";
import { Line, Marker, PadId, ID, LineUpdate, MarkerUpdate, Type, Bbox } from "facilmap-types";
import Database from "./database";
import { DataTypes, FindOptions, Op } from "sequelize";
import { isEqual } from "lodash";
import { calculateRouteForLine } from "../routing/routing";

const ITEMS_PER_BATCH = 5000;

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

export const validateColour = { is: /^[a-fA-F0-9]{3}([a-fA-F0-9]{3})?$/ };

export class DataModel extends Model {
	id!: ID;
	name!: string;
	value!: string;
}

export const dataDefinition = {
	"name" : { type: DataTypes.TEXT, allowNull: false },
	"value" : { type: DataTypes.TEXT, allowNull: false }
};

export function makeNotNullForeignKey(type: string, field: string, error = false): AssociationOptions {
	return {
		as: type,
		onDelete: error ? "RESTRICT" : "CASCADE",
		foreignKey: { name: field, allowNull: false }
	}
}

export interface BboxWithExcept extends Bbox {
	except?: Bbox;
}

export function makeBboxCondition(bbox: BboxWithExcept | null | undefined, prefix?: string): WhereOptions {
	if(!bbox)
		return { };

	prefix = prefix || "";

	const conditions = [ ];
	conditions.push({
		[prefix + "lat"]: { [Op.lte]: bbox.top, [Op.gte]: bbox.bottom }
	});

	if(bbox.right < bbox.left) { // Bbox spans over lon=180
		conditions.push({
			[Op.or]: [
				{ [prefix + "lon" ]: { [Op.gte]: bbox.left } },
				{ [prefix + "lon"]: { [Op.lte]: bbox.right } }
			]
		});
	} else {
		conditions.push({
			[prefix + "lon"]: { [Op.gte]: bbox.left, [Op.lte]: bbox.right }
		});
	}

	if(bbox.except) {
		const exceptConditions = [ ];
		exceptConditions.push({
			[Op.or]: [
				{ [prefix + "lat"]: { [Op.gt]: bbox.except.top } },
				{ [prefix + "lat"]: { [Op.lt]: bbox.except.bottom } }
			]
		});

		if(bbox.except.right < bbox.except.left) {
			exceptConditions.push({
				[prefix + "lon" ]: { [Op.lt]: bbox.except.left, [Op.gt]: bbox.except.right }
			});
		} else {
			exceptConditions.push({
				[Op.or]: [
					{ [prefix + "lon"]: { [Op.lt]: bbox.except.left } },
					{ [prefix + "lon"]: { [Op.gt]: bbox.except.right } }
				]
			});
		}
		conditions.push({
			[Op.or]: exceptConditions
		});
	}

	return {
		[Op.and]: conditions
	};
}

export default class DatabaseHelpers {

	_db: Database;

	constructor(db: Database) {
		this._db = db;
	}

	async _updateObjectStyles(objectStream: Marker | Line | Highland.Stream<Marker> | Highland.Stream<Line> | Highland.Stream<Marker | Line>): Promise<void> {
		const stream = (highland.isStream(objectStream) ? highland(objectStream) : highland([ objectStream ])) as Highland.Stream<Marker | Line>;

		type MarkerData = { object: Marker; type: Type; update: MarkerUpdate; };
		type LineData = { object: Line; type: Type; update: LineUpdate; };
		const isLine = (data: MarkerData | LineData): data is LineData => (data.type.type == "line");

		const types: Record<ID, Type> = { };
		await streamEachPromise(stream, async (object: Marker | Line) => {
			const padId = object.padId;

			if(!types[object.typeId]) {
				types[object.typeId] = await this._db.types.getType(padId, object.typeId);
				if(types[object.typeId] == null)
					throw new Error("Type "+object.typeId+" does not exist.");
			}

			const data = {
				object,
				type: types[object.typeId],
				update: { } as MarkerUpdate | LineUpdate
			} as MarkerData | LineData;

			if(data.type.colourFixed && data.type.defaultColour && object.colour != data.type.defaultColour)
				data.update.colour = data.type.defaultColour;

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
				if(data.type.modeFixed && data.object.mode != "track" && data.object.mode != data.type.defaultMode)
					data.update.mode = data.type.defaultMode!;
			}

			for(const field of data.type.fields) {
				if(field.controlColour || (!isLine(data) ? (field.controlSize || field.controlSymbol || field.controlShape) : field.controlWidth)) {
					const options = field.options ?? [];

					const _find = (value: string | undefined) => ((field.type == "dropdown" ? options.filter((option) => option.value == value)[0] : options[Number(value)]) || null);

					const option = _find(object.data[field.name]) || _find(field.default) || options[0];

					if(option != null) {
						if(field.controlColour && object.colour != option.colour)
							data.update.colour = option.colour;
						if(!isLine(data) && field.controlSize && data.object.size != option.size)
							data.update.size = option.size;
						if(!isLine(data) && field.controlSymbol && data.object.symbol != option.symbol)
							data.update.symbol = option.symbol;
						if(!isLine(data) && field.controlShape && data.object.shape != option.shape)
							data.update.shape = option.shape;
						if(isLine(data) && field.controlWidth && data.object.width != option.width)
							data.update.width = option.width;
					}
				}
			}

			const ret: Array<Promise<any>> = [ ];

			if(Object.keys(data.update).length > 0) {
				Object.assign(object, data.update);

				if(data.object.id) { // Objects from getLineTemplate() do not have an ID
					if (isLine(data)) {
						ret.push(this._db.lines.updateLine(padId, data.object.id, data.update, true));
					} else {
						ret.push(this._db.markers.updateMarker(padId, data.object.id, data.update, true));
					}
				}

				if(data.object.id && isLine(data) && "mode" in data.update) {
					ret.push(calculateRouteForLine(data.object).then(async ({ trackPoints, ...routeInfo }) => {
						Object.assign(object, routeInfo);
						await this._db.lines._setLinePoints(padId, data.object.id, trackPoints);
					}));
				}
			}

			await Promise.all(ret);
		});
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

	_toStream<T>(getData: () => Promise<Array<T>>): Highland.Stream<T> {
		return highland(getData()).flatten() as any;
	}

	_getPadObjects<T>(type: string, padId: PadId, condition?: FindOptions): Highland.Stream<T> {
		return this._toStream(async () => {
			const includeData = [ "Marker", "Line" ].includes(type);

			if(includeData) {
				condition = condition || { };
				condition.include = [ ...(condition.include ? (Array.isArray(condition.include) ? condition.include : [ condition.include ]) : [ ]), this._db._conn.model(type + "Data") ];
			}

			const Pad = this._db.pads.PadModel.build({ id: padId });
			const objs: Array<Model> = await (Pad as any)["get" + this._db._conn.model(type).getTableName()](condition);

			return objs.map((obj) => {
				const d: any = obj.toJSON();

				if(includeData) {
					d.data = this._dataFromArr((d as any)[type+"Data"]);
					delete (d as any)[type+"Data"];
				}

				return d;
			});
		});
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
		for(const i in data) {
			if(data[i] != null) {
				dataArr.push({ name: i, value: data[i], ...extend });
			}
		}
		return dataArr;
	}

	_dataFromArr(dataArr: Array<{ name: string; value: string }>): Record<string, string> {
		const data: Record<string, string> = { };
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

	renameObjectDataField(padId: PadId, typeId: ID, rename: Record<string, { name?: string; values?: Record<string, string> }>, isLine: boolean): Promise<void> {
		const objectStream = (isLine ? this._db.lines.getPadLinesByType(padId, typeId) : this._db.markers.getPadMarkersByType(padId, typeId)) as Highland.Stream<Marker | Line>;

		return streamEachPromise(objectStream, async (object) => {
			const newData = clone(object.data);
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
					await this._db.lines.updateLine(object.padId, object.id, {data: newData}, true); // Last param true to not create history entry
				else
					await this._db.markers.updateMarker(object.padId, object.id, {data: newData}, true); // Last param true to not create history entry
			}
		});
	}

	async _bulkCreateInBatches<T>(model: ModelCtor<Model>, data: Array<Record<string, unknown>>): Promise<Array<T>> {
		const result: Array<any> = [];
		for(let i=0; i<data.length; i+=ITEMS_PER_BATCH)
			result.push(...(await model.bulkCreate(data.slice(i, i+ITEMS_PER_BATCH))).map((it) => it.toJSON()));
		return result;
	}

}
