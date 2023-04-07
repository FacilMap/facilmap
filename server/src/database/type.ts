import Sequelize, { Model } from "sequelize";
import { Field, ID, PadId, Type, TypeCreate, TypeUpdate } from "facilmap-types";
import Database from "./database.js";
import { makeNotNullForeignKey, validateColour } from "./helpers.js";

function createTypeModel() {
	return class TypeModel extends Model {
		declare id: ID;
		declare name: string;
		declare type: "marker" | "line";
		declare padId: PadId;
		declare defaultColour: string | null;
		declare colourFixed: boolean | null;
		declare defaultSize: string | null;
		declare sizeFixed: boolean | null;
		declare defaultSymbol: string | null;
		declare symbolFixed: boolean | null;
		declare defaultShape: string | null;
		declare shapeFixed: boolean | null;
		declare defaultWidth: string | null;
		declare widthFixed: boolean | null;
		declare defaultMode: string | null;
		declare modeFixed: boolean | null;
		declare showInLegend: boolean | null;
		declare fields: Field[];
		declare toJSON: () => Type;
	};
}

export type TypeModel = InstanceType<ReturnType<typeof createTypeModel>>;

const DEFAULT_TYPES: TypeCreate[] = [
	{ name: "Marker", type: "marker", fields: [ { name: "Description", type: "textarea" } ] },
	{ name: "Line", type: "line", fields: [ { name: "Description", type: "textarea" } ] }
];

export default class DatabaseTypes {

	TypeModel = createTypeModel();

	_db: Database;

	constructor(database: Database) {
		this._db = database;

		this.TypeModel.init({
			name: { type: Sequelize.TEXT, allowNull: false },
			type: { type: Sequelize.ENUM("marker", "line"), allowNull: false },
			defaultColour: { type: Sequelize.STRING(6), allowNull: true, validate: validateColour },
			colourFixed: { type: Sequelize.BOOLEAN, allowNull: true },
			defaultSize: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, validate: { min: 15 } },
			sizeFixed: { type: Sequelize.BOOLEAN, allowNull: true },
			defaultSymbol: { type: Sequelize.TEXT, allowNull: true},
			symbolFixed: { type: Sequelize.BOOLEAN, allowNull: true},
			defaultShape: { type: Sequelize.TEXT, allowNull: true },
			shapeFixed: { type: Sequelize.BOOLEAN, allowNull: true },
			defaultWidth: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, validate: { min: 1 } },
			widthFixed: { type: Sequelize.BOOLEAN, allowNull: true },
			defaultMode: { type: Sequelize.TEXT, allowNull: true },
			modeFixed: { type: Sequelize.BOOLEAN, allowNull: true },
			showInLegend: { type: Sequelize.BOOLEAN, allowNull: true },

			fields: {
				type: Sequelize.TEXT,
				allowNull: false,
				get: function(this: TypeModel) {
					const fields = this.getDataValue("fields") as any as string;
					return fields == null ? [] : JSON.parse(fields);
				},
				set: function(this: TypeModel, v: Field[]) {
					for(const field of v) {
						if(field.controlSymbol) {
							for(const option of field.options ?? []) {
								if(!option.symbol)
									option.symbol = ""; // Avoid "undefined" ending up there, which messes everything up
							}
						}
						if(field.controlShape) {
							for(const option of field.options ?? []) {
								if(!option.shape)
									option.shape = ""; // Avoid "undefined" ending up there, which messes everything up
							}
						}
					}

					return this.setDataValue("fields", JSON.stringify(v) as any);
				},
				validate: {
					checkUniqueFieldName: (value: string) => {
						const fields = JSON.parse(value) as Field[];
						const fieldNames = new Set<string>();
						for (const field of fields) {
							if(field.name.trim().length == 0)
								throw new Error("Empty field name.");
							if(fieldNames.has(field.name))
								throw new Error("field name "+field.name+" is not unique.");

							fieldNames.add(field.name);

							if([ "textarea", "dropdown", "checkbox", "input" ].indexOf(field.type) == -1)
								throw new Error("Invalid field type "+field.type+" for field "+field.name+".");

							if(field.controlColour) {
								if(!field.options || field.options.length < 1)
									throw new Error("No options specified for colour-controlling field "+field.name+".");
								for (const option of field.options) {
									if(!option.colour || !option.colour.match(validateColour.is))
										throw new Error("Invalid colour "+option.colour+" in field "+field.name+".");
								}
							}

							if(field.controlSize) {
								if(!field.options || field.options.length < 1)
									throw new Error("No options specified for size-controlling field "+field.name+".");
								for(const option of field.options) {
									if(!option.size || !isFinite(option.size) || option.size < 15)
										throw new Error("Invalid size "+option.size+" in field "+field.name+".");
								}
							}

							if(field.controlSymbol) {
								if(!field.options || field.options.length < 1)
									throw new Error("No options specified for icon-controlling field "+field.name+".");
							}

							if(field.controlWidth) {
								if(!field.options || field.options.length < 1)
									throw new Error("No options specified for width-controlling field "+field.name+".");
								for(const option of field.options) {
									if(!option.width || !(1*option.width >= 1))
										throw new Error("Invalid width "+option.width+" in field "+field.name+".");
								}
							}

							// Validate unique dropdown entries
							if(field.type == "dropdown") {
								const existingValues = new Set<string>();
								for(const option of (field.options || [])) {
									if(existingValues.has(option.value))
										throw new Error(`Duplicate option "${option.value}" for field "${field.name}".`);
									existingValues.add(option.value);
								}
							}
						}
					}
				}
			}
		}, {
			sequelize: this._db._conn,
			validate: {
				defaultValsNotNull: function() {
					if(this.colourFixed && this.defaultColour == null)
						throw new Error("Fixed colour cannot be undefined.");
					if(this.sizeFixed && this.defaultSize == null)
						throw new Error("Fixed size cannot be undefined.");
					if(this.widthFixed && this.defaultWidth == null)
						throw new Error("Fixed width cannot be undefined.");
				}
			},
			modelName: "Type"
		});
	}

	afterInit(): void {
		const PadModel = this._db.pads.PadModel;
		this.TypeModel.belongsTo(PadModel, makeNotNullForeignKey("pad", "padId"));
		PadModel.hasMany(this.TypeModel, { foreignKey: "padId" });
	}

	getTypes(padId: PadId): Highland.Stream<Type> {
		return this._db.helpers._getPadObjects<Type>("Type", padId);
	}

	getType(padId: PadId, typeId: ID): Promise<Type> {
		return this._db.helpers._getPadObject<Type>("Type", padId, typeId);
	}

	async createType(padId: PadId, data: TypeCreate): Promise<Type> {
		if(data.name == null || data.name.trim().length == 0)
			throw new Error("No name provided.");

		const createdType = await this._db.helpers._createPadObject<Type>("Type", padId, data);
		this._db.emit("type", createdType.padId, createdType);
		return createdType;
	}

	async updateType(padId: PadId, typeId: ID, data: TypeUpdate, _doNotUpdateStyles?: boolean): Promise<Type> {
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