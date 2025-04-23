import { type AssociationOptions, Model, type ModelAttributeColumnOptions, type WhereOptions, DataTypes, Op, Sequelize, type ModelStatic, type CreationOptional } from "sequelize";
import { type ID, keys, type BboxWithExcept } from "facilmap-types";
import DatabaseBackend from "./database-backend.js";
import { cloneDeep } from "lodash-es";
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

export function getJsonType<T>(key: string, options: {
	allowNull: unknown extends T ? boolean : null extends T ? true : false;
	get?: (val: T | null) => T,
	set?: (val: T) => T,
	validate?: Record<string, (val: T) => void>;
}): ModelAttributeColumnOptions {
	return {
		type: DataTypes.TEXT,
		allowNull: options.allowNull,
		get: function(this: Model) {
			// rawVal is marked as type T but is actually a string, see https://github.com/sequelize/sequelize/issues/11558.
			// Here it does not matter, since we use Model<any>
			const rawVal = this.getDataValue(key);
			const val = rawVal == null || rawVal === "" ? null : JSON.parse(rawVal);
			return options.get ? options.get(val) : val;
		},
		set: function(this: Model, v: any) {
			const val = options.set ? options.set(v) : v;
			this.setDataValue(key, val == null ? val : JSON.stringify(val));
		},
		...options.validate ? {
			validate: Object.fromEntries(Object.entries(options.validate).map(([k, validate]) => [k, (v: any) => {
				const val = v == null ? v : JSON.parse(v);
				validate(val);
			}]))
		} : {}
	};
}

export interface DataModel {
	id: CreationOptional<ID>;
	fieldId: ID;
	value: string;
}

export const dataDefinition = {
	id: getDefaultIdType(),
	fieldId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
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

export function dataToArr<T>(data: Record<ID, string>, extend: T): Array<{ fieldId: ID; value: string } & T> {
	const dataArr: Array<{ fieldId: ID; value: string } & T> = [ ];
	for(const i of keys(data)) {
		if(data[i] != null) {
			dataArr.push({ fieldId: Number(i), value: data[i], ...extend });
		}
	}
	return dataArr;
}

export function dataFromArr(dataArr: Array<{ fieldId: string; value: string }>): Record<string, string> {
	const data: Record<string, string> = Object.create(null);
	for(let i=0; i<dataArr.length; i++)
		data[dataArr[i].fieldId] = dataArr[i].value;
	return data;
}

export function makeBboxCondition(backend: DatabaseBackend, bbox: BboxWithExcept | null | undefined, posField = "pos"): WhereOptions {
	const dbType  = backend._conn.getDialect()
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

export async function bulkCreateInBatches<T>(
	model: ModelStatic<Model>,
	data: Iterable<Record<string, unknown>> | AsyncIterable<Record<string, unknown>>,
	options?: {
		onBatch?: (batch: T[]) => void;
		signal?: AbortSignal;
	}
): Promise<void> {
	let slice: Array<Record<string, unknown>> = [];
	const createSlice = async () => {
		options?.signal?.throwIfAborted();
		const result = (await model.bulkCreate(slice)).map((it) => it.toJSON());
		options?.onBatch?.(result);
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
}