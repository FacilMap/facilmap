import { DataTypes, Model } from "sequelize";
import { BboxWithZoom, ID, Latitude, Longitude, Marker, MarkerCreate, MarkerUpdate, PadId } from "facilmap-types";
import { BboxWithExcept, dataDefinition, DataModel, getLatType, getLonType, makeBboxCondition, makeNotNullForeignKey, validateColour } from "./helpers";
import Database from "./database";
import { getElevationForPoint } from "../elevation";

function createMarkerModel() {
	return class MarkerModel extends Model {
		id!: ID;
		padId!: PadId;
		lat!: Latitude;
		lon!: Longitude;
		name!: string | null;
		colour!: string;
		size!: number;
		symbol!: string | null;
		shape!: string | null;
		ele!: number | null;
		toJSON!: () => Marker;
	};
}

function createMarkerDataModel() {
	return class MarkerData extends DataModel {};
}

export type MarkerModel = InstanceType<ReturnType<typeof createMarkerModel>>;

export default class DatabaseMarkers {

	MarkerModel = createMarkerModel();
	MarkerDataModel = createMarkerDataModel();

	_db: Database;

	constructor(database: Database) {
		this._db = database;

		this.MarkerModel.init({
			"lat" : getLatType(),
			"lon" : getLonType(),
			name : { type: DataTypes.TEXT, allowNull: true, get: function(this: MarkerModel) { return this.getDataValue("name") || "Untitled marker"; } },
			colour : { type: DataTypes.STRING(6), allowNull: false, defaultValue: "ff0000", validate: validateColour },
			size : { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 25, validate: { min: 15 } },
			symbol : { type: DataTypes.TEXT, allowNull: true },
			shape : { type: DataTypes.TEXT, allowNull: true },
			ele: { type: DataTypes.INTEGER, allowNull: true }
		}, {
			sequelize: this._db._conn,
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

	getPadMarkers(padId: PadId, bbox?: BboxWithZoom & BboxWithExcept): Highland.Stream<Marker> {
		return this._db.helpers._getPadObjects<Marker>("Marker", padId, { where: makeBboxCondition(bbox) });
	}

	getPadMarkersByType(padId: PadId, typeId: ID): Highland.Stream<Marker> {
		return this._db.helpers._getPadObjects<Marker>("Marker", padId, { where: { padId: padId, typeId: typeId } });
	}

	getMarker(padId: PadId, markerId: ID): Promise<Marker> {
		return this._db.helpers._getPadObject("Marker", padId, markerId);
	}

	async createMarker(padId: PadId, data: MarkerCreate): Promise<Marker> {
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

		await this._db.helpers._updateObjectStyles(result)

		this._db.emit("marker", padId, result);
		return result;
	}

	async updateMarker(padId: PadId, markerId: ID, data: MarkerUpdate, doNotUpdateStyles = false): Promise<Marker> {
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