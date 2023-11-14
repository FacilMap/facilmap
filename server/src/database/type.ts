import { type CreationOptional, DataTypes, type ForeignKey, type InferAttributes, type InferCreationAttributes, Model } from "sequelize";
import { typeValidator, type CRU, type Field, type ID, type PadId, type Type } from "facilmap-types";
import Database from "./database.js";
import { createModel, getDefaultIdType, makeNotNullForeignKey } from "./helpers.js";
import type { PadModel } from "./pad.js";

export interface TypeModel extends Model<InferAttributes<TypeModel>, InferCreationAttributes<TypeModel>> {
	id: CreationOptional<ID>;
	name: string;
	type: "marker" | "line";
	padId: ForeignKey<PadModel["id"]>;
	defaultColour: string;
	colourFixed: boolean;
	defaultSize: number;
	sizeFixed: boolean;
	defaultSymbol: string;
	symbolFixed: boolean;
	defaultShape: string;
	shapeFixed: boolean;
	defaultWidth: number;
	widthFixed: boolean;
	defaultMode: string;
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
			defaultMode: { type: DataTypes.TEXT, allowNull: false },
			modeFixed: { type: DataTypes.BOOLEAN, allowNull: false },
			showInLegend: { type: DataTypes.BOOLEAN, allowNull: false },

			fields: {
				type: DataTypes.TEXT,
				allowNull: false,
				get: function(this: TypeModel) {
					const fields = this.getDataValue("fields") as any as string;
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

	getTypes(padId: PadId): AsyncGenerator<Type, void, void> {
		return this._db.helpers._getPadObjects<Type>("Type", padId);
	}

	getType(padId: PadId, typeId: ID): Promise<Type> {
		return this._db.helpers._getPadObject<Type>("Type", padId, typeId);
	}

	async createType(padId: PadId, data: Type<CRU.CREATE_VALIDATED>): Promise<Type> {
		if(data.name == null || data.name.trim().length == 0)
			throw new Error("No name provided.");

		const createdType = await this._db.helpers._createPadObject<Type>("Type", padId, data);
		this._db.emit("type", createdType.padId, createdType);
		return createdType;
	}

	async updateType(padId: PadId, typeId: ID, data: Omit<Type<CRU.UPDATE_VALIDATED>, "id">, _doNotUpdateStyles?: boolean): Promise<Type> {
		if(data.name == null || data.name.trim().length == 0)
			throw new Error("No name provided.");

		const result = await this._db.helpers._updatePadObject<Type>("Type", padId, typeId, data);
		this._db.emit("type", result.padId, result);

		if(!_doNotUpdateStyles)
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
		return await Promise.all(DEFAULT_TYPES.map((it) => this.createType(padId, it)));
	}
}