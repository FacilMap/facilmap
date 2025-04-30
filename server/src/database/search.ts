import type { ID } from "facilmap-types";
import Database from "./database.js";
import { compareTwoStrings } from "string-similarity";
import { pick } from "lodash-es";
import type { RawFindOnMapResult } from "../utils/permissions.js";

export default class DatabaseSearch {

	protected db: Database;

	constructor(database: Database) {
		this.db = database;
	}

	async search(mapId: ID, searchText: string): Promise<Array<RawFindOnMapResult>> {
		const [markers, lines] = await Promise.all([
			this.db.backend.markers.searchMarkers(mapId, searchText),
			this.db.backend.lines.searchLines(mapId, searchText)
		]);

		const objects = [
			...markers.map((marker) => ({
				...pick(marker, ["id", "name", "typeId", "lat", "lon", "icon", "identity"]),
				kind: "marker" as const
			})),
			...lines.map((line) => ({
				...pick(line, ["id", "name", "typeId", "top", "left", "bottom", "right", "identity"]),
				kind: "line" as const
			}))
		].map((obj) => ({
			...obj,
			similarity: compareTwoStrings(searchText, obj.name ?? '')
		}));

		objects.sort((a, b) => (b.similarity - a.similarity));

		return objects;
	}

}