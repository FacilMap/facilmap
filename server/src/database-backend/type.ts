import { type CreationOptional, DataTypes, type ForeignKey, type InferAttributes, type InferCreationAttributes, Model } from "sequelize";
import { type Field, type ID, type Type, type Colour, type Size, type Icon, type Shape, type Width, type Stroke, type RouteMode } from "facilmap-types";
import DatabaseBackend from "./database-backend.js";
import { createModel, findAllStreamed, getDefaultIdType, getJsonType, makeNotNullForeignKey } from "./utils.js";
import type { MapModel } from "./map.js";
import { type Optional } from "facilmap-utils";

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
	formerFieldIds: Record<string, ID>;
};

export default class DatabaseTypesBackend {

	TypeModel = createModel<TypeModel>();

	backend: DatabaseBackend;

	constructor(backend: DatabaseBackend) {
		this.backend = backend;

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
			fields: getJsonType<Field[]>("fields", { allowNull: false, get: (v) => v ?? [] }),
			formerFieldIds: getJsonType<Record<string, ID>>("formerFieldIds", { allowNull: false, get: (v) => v ?? {} })
		}, {
			sequelize: this.backend._conn,
			modelName: "Type"
		});
	}

	afterInit(): void {
		const MapModel = this.backend.maps.MapModel;
		this.TypeModel.belongsTo(MapModel, makeNotNullForeignKey("map", "mapId"));
		MapModel.hasMany(this.TypeModel, { foreignKey: "mapId" });
	}

	protected prepareType(type: TypeModel): Type {
		return type.toJSON();
	}

	async* getTypes(mapId: ID): AsyncIterable<Type> {
		for await (const type of findAllStreamed(this.TypeModel, { where: { mapId }, order: [["idx", "asc"]] })) {
			yield this.prepareType(type);
		}
	}

	async typeExists(mapId: ID, typeId: ID): Promise<boolean> {
		return !!await this.TypeModel.findOne({ where: { mapId, id: typeId }, attributes: ["id"] });
	}

	async getType(mapId: ID, typeId: ID): Promise<Type | undefined> {
		const result = await this.TypeModel.findOne({ where: { id: typeId, mapId } });
		return result ? this.prepareType(result) : undefined;
	}

	async createType(mapId: ID, data: Optional<Omit<Type, "mapId">, "id">): Promise<Type> {
		return this.prepareType(await this.TypeModel.create({ ...data, mapId }));
	}

	async updateType(mapId: ID, typeId: ID, data: Partial<Omit<Type, "mapId">>): Promise<void> {
		// We don’t return the update object since we cannot rely on the return value of the update() method.
		// On some platforms it returns 0 even if the object was found (but no fields were changed).
		await this.TypeModel.update(data, { where: { id: typeId, mapId } });
	}

	async deleteType(mapId: ID, typeId: ID): Promise<void> {
		await this.TypeModel.destroy({ where: { id: typeId, mapId } });
	}

}