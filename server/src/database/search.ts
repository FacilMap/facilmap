import { FindOnMapResult, PadId } from "facilmap-types";
import { ModelStatic, Op, and, col, fn, where } from "sequelize";
import Database from "./database.js";
import { LineModel } from "./line.js";
import { MarkerModel } from "./marker.js";
import { compareTwoStrings } from "string-similarity";

export default class DatabaseSearch {

	_db: Database;

	constructor(database: Database) {
		this._db = database;
	}

	async search(padId: PadId, searchText: string): Promise<Array<FindOnMapResult>> {
		const objects = (await Promise.all([ "Marker", "Line" ].map(async (kind) => {
			const model = this._db._conn.model(kind) as ModelStatic<MarkerModel | LineModel>;
			const objs = await model.findAll<MarkerModel | LineModel>({
				where: and(
					{ padId },
					where(fn("lower", col(`${kind}.name`)), {[Op.like]: `%${searchText.toLowerCase()}%`})
				),
				attributes: [ "id", "name", "typeId" ].concat(kind == "Marker" ? [ "pos", "lat", "lon", "symbol" ] : [ "top", "left", "bottom", "right" ])
			});

			return objs.map((obj) => ({
				...obj.toJSON(),
				kind: kind.toLowerCase() as any,
				similarity: compareTwoStrings(searchText, obj.name ?? '')
			}));
		}))).flat();

		objects.sort((a, b) => (b.similarity - a.similarity));

		return objects;
	}

}