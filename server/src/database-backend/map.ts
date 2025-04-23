import { DataTypes, type InferAttributes, type InferCreationAttributes, Model, Op, Sequelize, type ForeignKey, type CreationOptional, type NonAttribute } from "sequelize";
import { type CRU, type FindMapsResult, type MapData, type MapSlug, type PagedResults, type MapDataWithWritable, Writable, type PagingInput, type ID, type MapPermissions, type View, type MapLink } from "facilmap-types";
import DatabaseBackend from "./database-backend.js";
import { createModel, getDefaultIdType, getJsonType, makeNotNullForeignKey } from "./utils.js";
import type { ViewModel } from "./view.js";
import { getI18n } from "../i18n.js";
import type { RawMapData, RawMapLink } from "../utils/permissions.js";
import { omit } from "lodash-es";
import { deserializeMapPermissions, serializeMapPermissions, type Optional } from "facilmap-utils";

export interface MapModel extends Model<InferAttributes<MapModel>, InferCreationAttributes<MapModel>> {
	id: CreationOptional<ID>;
	name: string;
	/**
	 * The salt that is used for the map link password hashes. The same salt is used for all passwords within
	 * the scope of a map and it never changes. This is because the validity of JWT tokens is determined by
	 * the map slug and password, so if the map slug and/or password are changed, the tokens become invalid,
	 * but if they are changed back, the tokens become valid again.
	 */
	salt: Buffer;
	jwtSecret: Buffer;
	searchEngines: boolean;
	description: string;
	clusterMarkers: boolean;
	legend1: string;
	legend2: string;
	defaultViewId: ForeignKey<ViewModel["id"]> | null;
	defaultView?: ViewModel;
	links?: MapLinkModel[];
	/** The ID of the next field that will be created */
	nextFieldId: ID;
};

export interface MapLinkModel extends Model<InferAttributes<MapLinkModel>, InferCreationAttributes<MapLinkModel>> {
	id: CreationOptional<ID>;
	mapId: ForeignKey<MapModel["id"]>;
	slug: MapSlug;
	password: Buffer | null;
	/** Derived from slug and password, used in map tokens */
	tokenHash: string;
	permissions: MapPermissions;
}

export default class DatabaseMapsBackend {

	MapModel = createModel<MapModel>();
	MapLinkModel = createModel<MapLinkModel>();

	protected backend: DatabaseBackend;

	constructor(backend: DatabaseBackend) {
		this.backend = backend;

		this.MapModel.init({
			id: getDefaultIdType(),
			name: { type: DataTypes.TEXT, allowNull: false },
			salt: { type: DataTypes.BLOB, allowNull: false },
			jwtSecret: { type: DataTypes.BLOB, allowNull: false },
			searchEngines: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
			description: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
			clusterMarkers: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
			legend1: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
			legend2: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
			nextFieldId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }
		}, {
			sequelize: this.backend._conn,
			modelName: "Map"
		});

		this.MapLinkModel.init({
			id: getDefaultIdType(),
			slug: { type: DataTypes.TEXT, allowNull: false },
			password: { type: DataTypes.BLOB, allowNull: true },
			tokenHash: { type: DataTypes.TEXT, allowNull: false },
			permissions: {
				type: DataTypes.TEXT,
				allowNull: false,
				get: function(this: Model) {
					return deserializeMapPermissions(this.getDataValue("permisions"));
				},
				set: function(this: Model, p: MapPermissions) {
					this.setDataValue("permissions", serializeMapPermissions(p));
				}
			}
		}, {
			sequelize: this.backend._conn,
			modelName: "MapLink",
			indexes: [
				{ fields: [ "id", "tokenHash" ] },
				{ fields: [ "slug" ] }
			]
		});
	}

	afterInit(): void {
		this.MapModel.belongsTo(this.backend.views.ViewModel, { as: "defaultView", foreignKey: "defaultViewId", constraints: false });

		this.MapLinkModel.belongsTo(this.MapModel, makeNotNullForeignKey("map", "mapId"));
		this.MapModel.hasMany(this.MapLinkModel, { as: "links", foreignKey: "mapId" });
	}

	// =====================================================================================================================

	async mapSlugExists(mapSlug: MapSlug): Promise<boolean> {
		return !!await this.MapLinkModel.findOne({ where: { slug: mapSlug }, attributes: ["id"] });
	}

	protected prepareMapData(mapData: MapModel): RawMapData {
		const result = mapData.toJSON();
		return {
			...result,
			defaultView: result.defaultView ? this.backend.views["prepareView"](result.defaultView) : null,
			links: result.links ? result.links.map((l) => this.prepareMapLink(l)) : []
		};
	}

	protected prepareMapLink(mapLink: MapLinkModel): RawMapLink {
		return mapLink.toJSON();
	}

	async getMapData(mapId: ID): Promise<RawMapData | undefined> {
		const obj = await this.MapModel.findOne({
			where: { id: mapId },
			include: [
				{ model: this.backend.views.ViewModel, as: "defaultView" }
			]
		});
		return obj ? this.prepareMapData(obj) : undefined;
	}

	async getMapLinkBySlug(mapSlug: MapSlug): Promise<RawMapLink | undefined> {
		const obj = await this.MapLinkModel.findOne({ where: { slug: mapSlug } });
		return obj ? this.prepareMapLink(obj) : undefined;
	}

	async getMapLinkByHash(mapId: ID, tokenHash: string): Promise<RawMapLink | undefined> {
		const obj = await this.MapLinkModel.findOne({ where: { mapId, tokenHash } });
		return obj ? this.prepareMapLink(obj) : undefined;
	}

	protected async setMapLinks(mapId: ID, links: Array<Optional<Omit<RawMapLink, "mapId">, "id">>, options?: { noClear?: boolean }): Promise<void> {
		if (!options?.noClear) {
			await this.MapLinkModel.destroy({ where: { mapId } });
		}
		await this.MapLinkModel.bulkCreate(links.map((l) => ({ ...l, mapId })));
	}

	async createMap(data: Optional<Omit<RawMapData, "defaultView" | "links">, "id"> & { links: Array<Optional<Omit<RawMapLink, "mapId">, "id">> }): Promise<RawMapData> {
		const createdObj = await this.MapModel.create(omit(data, ["links"]));
		await this.setMapLinks(createdObj.id, data.links, { noClear: true });
		const result = await this.getMapData(createdObj.id);
		if (!result) {
			throw new Error(getI18n().t("database.map-disappeared-error"));
		}
		return result;
	}

	async updateMapData(mapId: ID, data: Partial<Omit<RawMapData, "defaultView" | "links" | "id"> & { links: Array<Optional<Omit<RawMapLink, "mapId">, "id">> } >): Promise<void> {
		await Promise.all([
			this.MapModel.update(omit(data, ["links"]), { where: { id: mapId } }),
			data.links && this.setMapLinks(mapId, data.links)
		]);
	}

	async deleteMap(mapId: ID): Promise<void> {
		await this.setMapLinks(mapId, []);
		await this.MapModel.destroy({ where: { id: mapId } });
	}

	async findMaps(query: string, paging?: PagingInput): Promise<PagedResults<FindMapsResult>> {
		const like = query.toLowerCase().replace(/[%_\\]/g, "\\$&").replace(/[*]/g, "%").replace(/[?]/g, "_");
		const { count, rows } = await this.MapModel.findAndCountAll({
			where: Sequelize.and(
				{ searchEngines: true },
				Sequelize.where(Sequelize.fn("lower", Sequelize.col(`Map.name`)), {[Op.like]: `%${like}%`})
			),
			offset: paging?.start ?? 0,
			...paging?.limit != null ? {
				limit: paging.limit
			} : {},
			attributes: ["id", "readId", "name", "description"]
		});

		return {
			results: rows.map((row) => row.toJSON()),
			totalLength: count
		};
	}

}