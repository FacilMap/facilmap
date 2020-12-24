import { PadId } from "facilmap-types";
import Sequelize, { ModelCtor } from "sequelize";
import Database from "./database";
import { LineModel } from "./line";
import { MarkerModel } from "./marker";
import similarity from "string-similarity";

const Op = Sequelize.Op;

export default class DatabaseSearch {

	_db: Database;

	constructor(database: Database) {
		this._db = database;
	}

	async search(padId: PadId, searchText: string) {
		let objects = (await Promise.all([ "Marker", "Line" ].map(async (kind) => {
			const model = this._db._conn.model(kind) as ModelCtor<MarkerModel | LineModel>;
			let objs = await model.findAll<MarkerModel | LineModel>({
				where: Sequelize.and(
					{ padId },
					Sequelize.where(Sequelize.fn("lower", Sequelize.col(`${kind}.name`)), {[Op.like]: `%${searchText.toLowerCase()}%`})
				),
				attributes: [ "id", "name", "typeId" ].concat(kind == "Marker" ? [ "lat", "lon", "symbol" ] : [ "top", "left", "bottom", "right" ])
			});

			return objs.map((obj) => ({
				...obj.toJSON(),
				kind: kind.toLowerCase(),
				similarity: similarity.compareTwoStrings(searchText, obj.name ?? '')
			}));
		}))).flat();

		objects.sort((a, b) => (b.similarity - a.similarity));

		return objects;
	}

}