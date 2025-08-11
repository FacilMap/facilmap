import { DataTypes, type InferAttributes, type InferCreationAttributes, Model, Op, Sequelize, type ForeignKey, type CreationOptional } from "sequelize";
import { type FindMapsResult, type MapSlug, type PagedResults, type PagingInput, type ID, type MapPermissions } from "facilmap-types";
import DatabaseBackend from "./database-backend.js";
import { createModel, getDefaultIdType, makeNotNullForeignKey } from "./utils.js";
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
	readToken: MapSlug;
	comment: string;
	password: Buffer | null;
	permissions: MapPermissions;
	searchEngines: boolean;
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
			readToken: { type: DataTypes.TEXT, allowNull: false },
			comment: { type: DataTypes.TEXT, allowNull: false },
			password: { type: DataTypes.BLOB, allowNull: true },
			permissions: {
				type: DataTypes.TEXT,
				allowNull: false,
				get: function(this: Model) {
					return deserializeMapPermissions(this.getDataValue("permissions"));
				},
				set: function(this: Model, p: MapPermissions) {
					this.setDataValue("permissions", serializeMapPermissions(p));
				}
			},
			searchEngines: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
		}, {
			sequelize: this.backend._conn,
			modelName: "MapLink",
			indexes: [
				{ fields: [ { name: "slug", length: 16 } ] }
			]
		});
	}

	afterInit(): void {
		this.MapModel.belongsTo(this.backend.views.ViewModel, { as: "defaultView", foreignKey: "defaultViewId", constraints: false });
	}

	afterMigration1(): void {
		// We need to run this after migrations 1, since before "Map.id" might still be TEXT, so a foreign key
		// of type INTEGER will fail.
		this.MapLinkModel.belongsTo(this.MapModel, makeNotNullForeignKey("map", "mapId"));
		this.MapModel.hasMany(this.MapLinkModel, { as: "links", foreignKey: "mapId" });
	}

	// =====================================================================================================================

	async mapSlugExists(mapSlug: MapSlug, options?: { ignoreMapId?: ID }): Promise<boolean> {
		return !!await this.MapLinkModel.findOne({
			where: {
				slug: mapSlug,
				...options?.ignoreMapId != null ? { mapId: { [Op.ne]: options.ignoreMapId } } : {}
			},
			attributes: ["id"]
		});
	}

	async mapSlugsExist(mapSlugs: MapSlug[], options?: { ignoreMapId?: ID }): Promise<MapSlug[]> {
		const links = await this.MapLinkModel.findAll({
			where: {
				slug: mapSlugs,
				...options?.ignoreMapId != null ? { mapId: { [Op.ne]: options.ignoreMapId } } : {}
			},
			attributes: ["slug"]
		});
		return links.map((link) => link.slug);
	}

	protected prepareMapData(mapData: MapModel): RawMapData {
		return {
			...mapData.toJSON(),
			defaultView: mapData.defaultView ? this.backend.views["prepareView"](mapData.defaultView) : null,
			links: mapData.links ? mapData.links.map((l) => this.prepareMapLink(l)) : []
		};
	}

	protected prepareMapLink(mapLink: MapLinkModel): RawMapLink {
		return mapLink.toJSON();
	}

	async getMapData(mapId: ID): Promise<RawMapData | undefined> {
		const obj = await this.MapModel.findOne({
			where: { id: mapId },
			include: [
				{ model: this.backend.views.ViewModel, as: "defaultView" },
				{ model: this.MapLinkModel, as: "links" }
			]
		});
		return obj ? this.prepareMapData(obj) : undefined;
	}

	async getMapDataBySlug(mapSlug: MapSlug): Promise<RawMapData | undefined> {
		const obj = await this.MapLinkModel.findOne({
			where: { slug: mapSlug },
			attributes: ["mapId"]
		});
		return obj ? await this.getMapData(obj.mapId) : undefined;
	}

	protected async setMapLinks(mapId: ID, links: Array<Optional<Omit<RawMapLink, "mapId">, "id">>, options?: { noClear?: boolean }): Promise<void> {
		if (!options?.noClear) {
			await this.MapLinkModel.destroy({ where: { mapId } });
		}
		await this.MapLinkModel.bulkCreate(links.map((l) => ({ ...l, mapId })));
	}

	async createMap(data: Optional<Omit<RawMapData, "defaultView" | "links">, "id"> & { links: Array<Optional<Omit<RawMapLink, "mapId">, "id">> | ((mapId: ID) => Promise<Array<Optional<Omit<RawMapLink, "mapId">, "id">>>) }): Promise<RawMapData> {
		const createdObj = await this.MapModel.create(omit(data, ["links"]));
		const links = typeof data.links === "function" ? await data.links(createdObj.id) : data.links;
		await this.setMapLinks(createdObj.id, links, { noClear: true });
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
		const { count, rows } = await this.MapLinkModel.findAndCountAll({
			where: Sequelize.and(
				{ searchEngines: true },
				Sequelize.where(Sequelize.fn("lower", Sequelize.col(`Map.name`)), {[Op.like]: `%${like}%`})
			),
			offset: paging?.start ?? 0,
			...paging?.limit != null ? {
				limit: paging.limit
			} : {},
			include: [
				{
					model: this.MapModel,
					through: {
						attributes: ["name", "description"]
					}
				}
			],
			attributes: ["mapId", "slug"]
		});

		return {
			results: rows.map((row) => ({
				id: row.mapId,
				slug: row.slug,
				name: (row as any).map.name,
				description: (row as any).map.description
			})),
			totalLength: count
		};
	}

}