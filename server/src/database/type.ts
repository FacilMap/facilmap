import { type CreationOptional, DataTypes, type ForeignKey, type InferAttributes, type InferCreationAttributes, Model } from "sequelize";
import { typeValidator, type CRU, type Field, type ID, type Type, type Colour, type Size, type Icon, type Shape, type Width, type Stroke, type RouteMode } from "facilmap-types";
import Database from "./database.js";
import { createModel, getDefaultIdType, makeNotNullForeignKey } from "./helpers.js";
import type { MapModel } from "./map.js";
import { iterableToArray } from "../utils/streams.js";
import { insertIdx } from "facilmap-utils";

export interface TypeModel extends Model<InferAttributes<TypeModel>, InferCreationAttributes<TypeModel>> {
	id: CreationOptional<ID>;
	name: string;
	type: "marker" | "line";
	idx: number;
	mapId: ForeignKey<MapModel["id"]>;
	defaultColour: Colour;
	colourFixed: boolean;
	defaultSize: Size;
	sizeFixed: boolean;
	defaultIcon: Icon;
	iconFixed: boolean;
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
			defaultIcon: { type: DataTypes.TEXT, allowNull: false },
			iconFixed: { type: DataTypes.BOOLEAN, allowNull: false },
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
		const MapModel = this._db.maps.MapModel;
		this.TypeModel.belongsTo(MapModel, makeNotNullForeignKey("map", "mapId"));
		MapModel.hasMany(this.TypeModel, { foreignKey: "mapId" });
	}

	getTypes(mapId: ID): AsyncIterable<Type> {
		return this._db.helpers._getMapObjects<Type>("Type", mapId);
	}

	getType(mapId: ID, typeId: ID, options?: { notFound404?: boolean }): Promise<Type> {
		return this._db.helpers._getMapObject<Type>("Type", mapId, typeId, options);
	}

	async _freeTypeIdx(mapId: ID, typeId: ID | undefined, newIdx: number | undefined): Promise<number> {
		const existingTypes = await iterableToArray(this.getTypes(mapId));

		const resolvedNewIdx = newIdx ?? (existingTypes.length > 0 ? existingTypes[existingTypes.length - 1].idx + 1 : 0);

		const newIndexes = insertIdx(existingTypes, typeId, resolvedNewIdx).reverse();

		for (const obj of newIndexes) {
			if ((typeId == null || obj.id !== typeId) && obj.oldIdx !== obj.newIdx) {
				const result = await this._db.helpers._updateMapObject<Type>("Type", mapId, obj.id, { idx: obj.newIdx }, { noHistory: true });
				this._db.emit("type", result.mapId, result);
			}
		}

		return resolvedNewIdx;
	}

	async createType(mapId: ID, data: Type<CRU.CREATE_VALIDATED>): Promise<Type> {
		const idx = await this._freeTypeIdx(mapId, undefined, data.idx);

		const createdType = await this._db.helpers._createMapObject<Type>("Type", mapId, {
			...data,
			idx
		});
		this._db.emit("type", createdType.mapId, createdType);
		return createdType;
	}

	async updateType(mapId: ID, typeId: ID, data: Type<CRU.UPDATE_VALIDATED>, options?: { notFound404?: boolean }): Promise<Type> {
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
			await this._freeTypeIdx(mapId, typeId, data.idx);
		}

		const result = await this._db.helpers._updateMapObject<Type>("Type", mapId, typeId, data, options);
		this._db.emit("type", result.mapId, result);

		if(Object.keys(rename).length > 0)
			await this._db.helpers.renameObjectDataField(mapId, result.id, rename, result.type == "line");

		await this.recalculateObjectStylesForType(result.mapId, typeId, result.type == "line");

		return result;
	}

	async recalculateObjectStylesForType(mapId: ID, typeId: ID, isLine: boolean): Promise<void> {
		await this._db.helpers._updateObjectStyles(isLine ? this._db.lines.getMapLinesByType(mapId, typeId) : this._db.markers.getMapMarkersByType(mapId, typeId));
	}

	async isTypeUsed(mapId: ID, typeId: ID): Promise<boolean> {
		const [ marker, line ] = await Promise.all([
			this._db.markers.MarkerModel.findOne({ where: { mapId, typeId: typeId } }),
			this._db.lines.LineModel.findOne({ where: { mapId, typeId: typeId } })
		]);

		return !!marker || !!line;
	}

	async deleteType(mapId: ID, typeId: ID, options?: { notFound404?: boolean }): Promise<Type> {
		if (await this.isTypeUsed(mapId, typeId))
			throw new Error("This type is in use.");

		const type = await this._db.helpers._deleteMapObject<Type>("Type", mapId, typeId, options);

		this._db.emit("deleteType", mapId, { id: type.id });

		return type;
	}

	async createDefaultTypes(mapId: ID): Promise<Type[]> {
		const result: Type[] = [];
		for (const type of DEFAULT_TYPES) {
			result.push(await this.createType(mapId, type));
		}
		return result;
	}
}