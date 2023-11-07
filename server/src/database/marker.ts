import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { BboxWithZoom, CRU, ID, Latitude, Longitude, Marker, PadId } from "facilmap-types";
import { BboxWithExcept, createModel, dataDefinition, DataModel, getDefaultIdType, getPosType, getVirtualLatType, getVirtualLonType, makeBboxCondition, makeNotNullForeignKey, validateColour } from "./helpers.js";
import Database from "./database.js";
import { getElevationForPoint } from "../elevation.js";
import { PadModel } from "./pad.js";
import { Point as GeoJsonPoint } from "geojson";
import { TypeModel } from "./type.js";

export interface MarkerModel extends Model<InferAttributes<MarkerModel>, InferCreationAttributes<MarkerModel>> {
	id: CreationOptional<ID>;
	padId: ForeignKey<PadModel["id"]>;
	pos: GeoJsonPoint;
	lat: Latitude;
	lon: Longitude;
	name: string | null;
	typeId: ForeignKey<TypeModel["id"]>;
	colour: string;
	size: number;
	symbol: string | null;
	shape: string | null;
	ele: number | null;
	toJSON: () => Marker;
}

export default class DatabaseMarkers {

	MarkerModel = createModel<MarkerModel>();
	MarkerDataModel = createModel<DataModel>();

	_db: Database;

	constructor(database: Database) {
		this._db = database;

		this.MarkerModel.init({
			id: getDefaultIdType(),
			lat: getVirtualLatType(),
			lon: getVirtualLonType(),
			pos: getPosType(),
			name : { type: DataTypes.TEXT, allowNull: true, get: function(this: MarkerModel) { return this.getDataValue("name") || ""; } },
			colour : { type: DataTypes.STRING(6), allowNull: false, defaultValue: "ff0000", validate: validateColour },
			size : { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 25, validate: { min: 15 } },
			symbol : { type: DataTypes.TEXT, allowNull: true },
			shape : { type: DataTypes.TEXT, allowNull: true },
			ele: { type: DataTypes.INTEGER, allowNull: true }
		}, {
			sequelize: this._db._conn,
			// pos index is created in migration
			modelName: "Marker"
		});

		this.MarkerDataModel.init(dataDefinition, {
			sequelize: this._db._conn,
			modelName: "MarkerData"
		});
	}

	afterInit(): void {
		const PadModel = this._db.pads.PadModel;
		const TypeModel = this._db.types.TypeModel;

		PadModel.hasMany(this.MarkerModel, makeNotNullForeignKey("Markers", "padId"));
		this.MarkerModel.belongsTo(PadModel, makeNotNullForeignKey("pad", "padId"));
		this.MarkerModel.belongsTo(TypeModel, makeNotNullForeignKey("type", "typeId", true));

		this.MarkerDataModel.belongsTo(this.MarkerModel, makeNotNullForeignKey("marker", "markerId"));
		this.MarkerModel.hasMany(this.MarkerDataModel, { foreignKey: "markerId" });
	}

	getPadMarkers(padId: PadId, bbox?: BboxWithZoom & BboxWithExcept): AsyncGenerator<Marker, void, void> {
		return this._db.helpers._getPadObjects<Marker>("Marker", padId, { where: makeBboxCondition(bbox) });
	}

	getPadMarkersByType(padId: PadId, typeId: ID): AsyncGenerator<Marker, void, void> {
		return this._db.helpers._getPadObjects<Marker>("Marker", padId, { where: { padId: padId, typeId: typeId } });
	}

	getMarker(padId: PadId, markerId: ID): Promise<Marker> {
		return this._db.helpers._getPadObject("Marker", padId, markerId);
	}

	async createMarker(padId: PadId, data: Marker<CRU.CREATE>): Promise<Marker> {
		const type = await this._db.types.getType(padId, data.typeId);
		const elevation = await getElevationForPoint(data);

		if(type.defaultColour)
			data.colour = type.defaultColour;
		if(type.defaultSize)
			data.size = type.defaultSize;
		if(type.defaultSymbol)
			data.symbol = type.defaultSymbol;
		if(type.defaultShape)
			data.shape = type.defaultShape;

		data.ele = elevation;

		const result = await this._db.helpers._createPadObject<Marker>("Marker", padId, data);

		await this._db.helpers._updateObjectStyles(result);

		this._db.emit("marker", padId, result);
		return result;
	}

	async updateMarker(padId: PadId, markerId: ID, data: Marker<CRU.UPDATE>, doNotUpdateStyles = false): Promise<Marker> {
		const update = { ...data };

		if (update.lat != null && update.lon != null)
			update.ele = await getElevationForPoint({ lat: update.lat, lon: update.lon });

		const result = await this._db.helpers._updatePadObject<Marker>("Marker", padId, markerId, update, doNotUpdateStyles);

		if(!doNotUpdateStyles)
			await this._db.helpers._updateObjectStyles(result);

		this._db.emit("marker", padId, result);

		return result;
	}

	async deleteMarker(padId: PadId, markerId: ID): Promise<Marker> {
		const result = await this._db.helpers._deletePadObject<Marker>("Marker", padId, markerId);
		this._db.emit("deleteMarker", padId, { id: result.id });
		return result;
	}

}