import { Line, Marker, PadId } from "facilmap-types";
import Sequelize, { ModelCtor } from "sequelize";
import Database from "./database";
import { LineModel } from "./line";
import { MarkerModel } from "./marker";
import similarity from "string-similarity";

type DatabaseSearchResult = ((Marker & { kind: "marker" }) | (Line & { kind: "line" })) & {
	similarity: number;
};

const Op = Sequelize.Op;

export default class DatabaseSearch {

	_db: Database;

	constructor(database: Database) {
		this._db = database;
	}

	async search(padId: PadId, searchText: string): Promise<Array<DatabaseSearchResult>> {
		const objects = (await Promise.all([ "Marker", "Line" ].map(async (kind) => {
			const model = this._db._conn.model(kind) as ModelCtor<MarkerModel | LineModel>;
			const objs = await model.findAll<MarkerModel | LineModel>({
				where: Sequelize.and(
					{ padId },
					Sequelize.where(Sequelize.fn("lower", Sequelize.col(`${kind}.name`)), {[Op.like]: `%${searchText.toLowerCase()}%`})
				),
				attributes: [ "id", "name", "typeId" ].concat(kind == "Marker" ? [ "lat", "lon", "symbol" ] : [ "top", "left", "bottom", "right" ])
			});

			return objs.map((obj) => ({
				...obj.toJSON(),
				kind: kind.toLowerCase() as any,
				similarity: similarity.compareTwoStrings(searchText, obj.name ?? '')
			}));
		}))).flat();

		objects.sort((a, b) => (b.similarity - a.similarity));

		return objects;
	}

}