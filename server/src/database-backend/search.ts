import type { FindOnMapResult, ID } from "facilmap-types";
import { type ModelStatic, Op, and, col, fn, where } from "sequelize";
import DatabaseBackend from "./database.js";
import type { LineModel } from "./line.js";
import type { MarkerModel } from "./marker.js";
import { compareTwoStrings } from "string-similarity";

export default class DatabaseSearch {

	_db: DatabaseBackend;

	constructor(database: DatabaseBackend) {
		this._db = database;
	}

	async search(mapId: ID, searchText: string): Promise<Array<FindOnMapResult>> {
		const objects = (await Promise.all([ "Marker", "Line" ].map(async (kind) => {
			const model = this._db._conn.model(kind) as ModelStatic<MarkerModel | LineModel>;
			const objs = await model.findAll<MarkerModel | LineModel>({
				where: and(
					{ mapId },
					where(fn("lower", col(`${kind}.name`)), {[Op.like]: `%${searchText.toLowerCase()}%`})
				),
				attributes: [ "id", "name", "typeId" ].concat(kind == "Marker" ? [ "pos", "lat", "lon", "icon" ] : [ "top", "left", "bottom", "right" ])
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