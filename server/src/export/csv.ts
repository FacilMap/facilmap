import { streamPromiseToStream, mapStream } from "../utils/streams.js";
import type { PadId, ID } from "facilmap-types";
import Database from "../database/database.js";
import type { ReadableStream } from "stream/web";
import { stringify } from "csv-stringify";
import { Readable, Writable } from "stream";
import { getTabularData } from "./tabular.js";

export function exportCsv(
	database: Database,
	padId: PadId,
	typeId: ID,
	filter?: string,
	hide: string[] = []
): ReadableStream<string> {
	return streamPromiseToStream((async () => {
		const tabular = await getTabularData(database, padId, typeId, false, filter, hide);

		const stringifier = stringify();
		stringifier.write(tabular.fields);
		mapStream(tabular.objects, (obj) => Object.values(obj)).pipeTo(Writable.toWeb(stringifier));

		return Readable.toWeb(stringifier);
	})());
}
