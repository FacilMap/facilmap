import { type CreationOptional, DataTypes, type ForeignKey, type InferAttributes, type InferCreationAttributes, Model } from "sequelize";
import type { ID, Latitude, Longitude, View } from "facilmap-types";
import DatabaseBackend from "./database-backend.js";
import { createModel, findAllStreamed, getDefaultIdType, getJsonType, getLatType, getLonType, makeNotNullForeignKey } from "./utils.js";
import type { MapModel } from "./map.js";
import type { Optional } from "facilmap-utils";

export interface ViewModel extends Model<InferAttributes<ViewModel>, InferCreationAttributes<ViewModel>> {
	id: CreationOptional<ID>;
	mapId: ForeignKey<MapModel["id"]>;
	name: string;
	idx: number;
	baseLayer: string;
	layers: string[];
	top: Latitude;
	bottom: Latitude;
	left: Longitude;
	right: Longitude;
	filter: string | null;
}

export default class DatabaseViewsBackend {

	ViewModel = createModel<ViewModel>();

	backend: DatabaseBackend;

	constructor(backend: DatabaseBackend) {
		this.backend = backend;

		this.ViewModel.init({
			id: getDefaultIdType(),
			name : { type: DataTypes.TEXT, allowNull: false },
			idx: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
			baseLayer : { type: DataTypes.TEXT, allowNull: false },
			layers : getJsonType("layers", { allowNull: false, get: (v) => v ?? [] }),
			top : getLatType(),
			bottom : getLatType(),
			left : getLonType(),
			right : getLonType(),
			filter: { type: DataTypes.TEXT, allowNull: true }
		}, {
			sequelize: this.backend._conn,
			modelName: "View"
		});
	}

	afterInit(): void {
		this.ViewModel.belongsTo(this.backend.maps.MapModel, makeNotNullForeignKey("map", "mapId"));
		this.backend.maps.MapModel.hasMany(this.ViewModel, { foreignKey: "mapId" });
	}

	protected prepareView(view: ViewModel): View {
		return view.toJSON();
	}

	async* getViews(mapId: ID): AsyncIterable<View> {
		for await (const obj of findAllStreamed(this.ViewModel, { where: { mapId }, order: [["idx", "asc"]] })) {
			yield this.prepareView(obj);
		}
	}

	async viewExists(mapId: ID, viewId: ID): Promise<boolean> {
		return !!await this.ViewModel.findOne({ where: { mapId, id: viewId }, attributes: ["id"] });
	}

	async getView(mapId: ID, viewId: ID): Promise<View | undefined> {
		const result = await this.ViewModel.findOne({
			where: { id: viewId, mapId }
		});
		return result ? this.prepareView(result) : undefined;
	}

	async createView(mapId: ID, data: Optional<Omit<View, "mapId">, "id">): Promise<View> {
		return this.prepareView(await this.ViewModel.create({ ...data, mapId }));
	}

	async updateView(mapId: ID, viewId: ID, data: Partial<Omit<View, "mapId" | "id">>): Promise<void> {
		// We don’t return the update object since we cannot rely on the return value of the update() method.
		// On some platforms it returns 0 even if the object was found (but no fields were changed).
		await this.ViewModel.update(data, { where: { id: viewId, mapId } });
	}

	async deleteView(mapId: ID, viewId: ID): Promise<void> {
		await this.ViewModel.destroy({ where: { id: viewId, mapId } });
	}
}