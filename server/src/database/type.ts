import { type CreationOptional, DataTypes, type ForeignKey, type InferAttributes, type InferCreationAttributes, Model } from "sequelize";
import { typeValidator, type CRU, type Field, type ID, type PadId, type Type, type Colour, type Size, type Symbol, type Shape, type Width, type Stroke, type RouteMode } from "facilmap-types";
import Database from "./database.js";
import { createModel, getDefaultIdType, makeNotNullForeignKey } from "./helpers.js";
import type { PadModel } from "./pad.js";
import { asyncIteratorToArray } from "../utils/streams.js";
import { insertIdx } from "facilmap-utils";

export interface TypeModel extends Model<InferAttributes<TypeModel>, InferCreationAttributes<TypeModel>> {
	id: CreationOptional<ID>;
	name: string;
	type: "marker" | "line";
	idx: number;
	padId: ForeignKey<PadModel["id"]>;
	defaultColour: Colour;
	colourFixed: boolean;
	defaultSize: Size;
	sizeFixed: boolean;
	defaultSymbol: Symbol;
	symbolFixed: boolean;
	defaultShape: Shape;
	shapeFixed: boolean;
	defaultWidth: Width;
	widthFixed: boolean;
	defaultStroke: Stroke;
	strokeFixed: boolean;
	defaultMode: RouteMode;
	modeFixed: boolean;
	showInLegend: boolean;
	fields: Field[];
	toJSON: () => Type;
};

const DEFAULT_TYPES: Type<CRU.CREATE_VALIDATED>[] = [
	typeValidator.create.parse({ name: "Marker", type: "marker" } satisfies Type<CRU.CREATE>),
	typeValidator.create.parse({ name: "Line", type: "line" } satisfies Type<CRU.CREATE>)
];

export default class DatabaseTypes {

	TypeModel = createModel<TypeModel>();

	_db: Database;

	constructor(database: Database) {
		this._db = database;

		this.TypeModel.init({
			id: getDefaultIdType(),
			name: { type: DataTypes.TEXT, allowNull: false },
			type: { type: DataTypes.ENUM("marker", "line"), allowNull: false },
			idx: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			defaultColour: { type: DataTypes.STRING(6), allowNull: false },
			colourFixed: { type: DataTypes.BOOLEAN, allowNull: false },
			defaultSize: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			sizeFixed: { type: DataTypes.BOOLEAN, allowNull: false },
			defaultSymbol: { type: DataTypes.TEXT, allowNull: false },
			symbolFixed: { type: DataTypes.BOOLEAN, allowNull: false },
			defaultShape: { type: DataTypes.TEXT, allowNull: false },
			shapeFixed: { type: DataTypes.BOOLEAN, allowNull: false },
			defaultWidth: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			widthFixed: { type: DataTypes.BOOLEAN, allowNull: false },
			defaultStroke: { type: DataTypes.TEXT, allowNull: false },
			strokeFixed: { type: DataTypes.BOOLEAN, allowNull: false },
			defaultMode: { type: DataTypes.TEXT, allowNull: false },
			modeFixed: { type: DataTypes.BOOLEAN, allowNull: false },
			showInLegend: { type: DataTypes.BOOLEAN, allowNull: false },

			fields: {
				type: DataTypes.TEXT,
				allowNull: false,
				get: function(this: TypeModel) {
					const fields = this.getDataValue("fields") as any as string; // https://github.com/sequelize/sequelize/issues/11558
					return fields == null ? [] : JSON.parse(fields);
				},
				set: function(this: TypeModel, v: Field[]) {
					return this.setDataValue("fields", JSON.stringify(v) as any);
				}
			}
		}, {
			sequelize: this._db._conn,
			modelName: "Type"
		});
	}

	afterInit(): void {
		const PadModel = this._db.pads.PadModel;
		this.TypeModel.belongsTo(PadModel, makeNotNullForeignKey("pad", "padId"));
		PadModel.hasMany(this.TypeModel, { foreignKey: "padId" });
	}

	getTypes(padId: PadId): AsyncIterable<Type> {
		return this._db.helpers._getPadObjects<Type>("Type", padId);
	}

	getType(padId: PadId, typeId: ID): Promise<Type> {
		return this._db.helpers._getPadObject<Type>("Type", padId, typeId);
	}

	async _freeTypeIdx(padId: PadId, typeId: ID | undefined, newIdx: number | undefined): Promise<number> {
		const existingTypes = await asyncIteratorToArray(this.getTypes(padId));

		const resolvedNewIdx = newIdx ?? (existingTypes.length > 0 ? existingTypes[existingTypes.length - 1].idx + 1 : 0);

		const newIndexes = insertIdx(existingTypes, typeId, resolvedNewIdx).reverse();

		for (const obj of newIndexes) {
			if ((typeId == null || obj.id !== typeId) && obj.oldIdx !== obj.newIdx) {
				const result = await this._db.helpers._updatePadObject<Type>("Type", padId, obj.id, { idx: obj.newIdx }, true);
				this._db.emit("type", result.padId, result);
			}
		}

		return resolvedNewIdx;
	}

	async createType(padId: PadId, data: Type<CRU.CREATE_VALIDATED>): Promise<Type> {
		const idx = await this._freeTypeIdx(padId, undefined, data.idx);

		const createdType = await this._db.helpers._createPadObject<Type>("Type", padId, {
			...data,
			idx
		});
		this._db.emit("type", createdType.padId, createdType);
		return createdType;
	}

	async updateType(padId: PadId, typeId: ID, data: Omit<Type<CRU.UPDATE_VALIDATED>, "id">): Promise<Type> {
		const rename: Record<string, { name?: string, values?: Record<string, string> }> = {};
		for(const field of (data.fields || [])) {
			if(field.oldName && field.oldName != field.name)
				rename[field.oldName] = { name: field.name };

			if(field.options) {
				for(const option of field.options) {
					if(option.oldValue && option.oldValue != option.value) {
						if(!rename[field.oldName || field.name])
							rename[field.oldName || field.name] = { };
						if(!rename[field.oldName || field.name].values)
							rename[field.oldName || field.name].values = { };

						rename[field.oldName || field.name].values![option.oldValue] = option.value;
					}

					delete option.oldValue;
				}
			}

			delete field.oldName;
		}

		if (data.idx != null) {
			await this._freeTypeIdx(padId, typeId, data.idx);
		}

		const result = await this._db.helpers._updatePadObject<Type>("Type", padId, typeId, data);
		this._db.emit("type", result.padId, result);

		if(Object.keys(rename).length > 0)
			await this._db.helpers.renameObjectDataField(padId, result.id, rename, result.type == "line");

		await this.recalculateObjectStylesForType(result.padId, typeId, result.type == "line");

		return result;
	}

	async recalculateObjectStylesForType(padId: PadId, typeId: ID, isLine: boolean): Promise<void> {
		await this._db.helpers._updateObjectStyles(isLine ? this._db.lines.getPadLinesByType(padId, typeId) : this._db.markers.getPadMarkersByType(padId, typeId));
	}

	async isTypeUsed(padId: PadId, typeId: ID): Promise<boolean> {
		const [ marker, line ] = await Promise.all([
			this._db.markers.MarkerModel.findOne({ where: { padId: padId, typeId: typeId } }),
			this._db.lines.LineModel.findOne({ where: { padId: padId, typeId: typeId } })
		]);

		return !!marker || !!line;
	}

	async deleteType(padId: PadId, typeId: ID): Promise<Type> {
		if (await this.isTypeUsed(padId, typeId))
			throw new Error("This type is in use.");

		const type = await this._db.helpers._deletePadObject<Type>("Type", padId, typeId);

		this._db.emit("deleteType", padId, { id: type.id });

		return type;
	}

	async createDefaultTypes(padId: PadId): Promise<Type[]> {
		const result: Type[] = [];
		for (const type of DEFAULT_TYPES) {
			result.push(await this.createType(padId, type));
		}
		return result;
	}
}