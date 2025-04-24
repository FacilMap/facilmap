import { readableToWeb, streamPromiseToStream, writableToWeb } from "../utils/streams.js";
import type { ID } from "facilmap-types";
import { stringify } from "csv-stringify";
import { getTabularData } from "./tabular.js";
import type { RawMapLink } from "../utils/permissions.js";
import type { ApiV3Backend } from "../api/api-v3.js";

export function exportCsv(
	api: ApiV3Backend,
	mapLink: RawMapLink,
	typeId: ID,
	filter?: string,
	hide: string[] = []
): ReadableStream<string> {
	return streamPromiseToStream((async () => {
		const tabular = await getTabularData(api, mapLink, typeId, false, filter, hide);

		const stringifier = stringify();
		stringifier.write(tabular.fieldNames);
		void tabular.objects.pipeTo(writableToWeb(stringifier));

		return readableToWeb(stringifier);
	})());
}
