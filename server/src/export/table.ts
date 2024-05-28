import type { ID } from "facilmap-types";
import { quoteHtml } from "facilmap-utils";
import Database from "../database/database.js";
import { renderTable } from "../frontend.js";
import { iterableToArray, iterableToStream, streamPromiseToStream, streamToIterable } from "../utils/streams.js";
import { getTabularData } from "./tabular.js";
import { getI18n } from "../i18n.js";

export type TableParams = {
	indent?: string;
	tableAttrs?: Record<string, string>;
	getThAttrs?: (fieldName: string, isFirst: boolean) => Record<string, string> | undefined;
	/** Emitted before the table, unless leaveEmpty is true and the table is empty. */
	before?: string;
	/** Emitted after the table, unless leaveEmpty is true and the table is empty. */
	after?: string;
	/** Emit an empty string if the table contains no objects. */
	leaveEmpty?: boolean;
};

export function createSingleTable(
	database: Database,
	mapId: ID,
	typeId: ID,
	filter?: string,
	hide: string[] = [],
	{ indent = "", tableAttrs, getThAttrs, before, after, leaveEmpty }: TableParams = {}
): ReadableStream<string> {
	return iterableToStream((async function* () {
		function attrs(a: Record<string, string> = {}) {
			return Object.entries(a).map(([k, v]) => ` ${quoteHtml(k)}="${quoteHtml(v)}"`).join("");
		}

		const tabular = await getTabularData(database, mapId, typeId, true, filter, hide);

		function* generateBefore() {
			if (before) {
				yield `${before}`;
			}

			yield `${indent}<table${attrs(tableAttrs)}>\n`;
			yield `${indent}\t<thead>\n`;
			yield `${indent}\t\t<tr>\n`;

			let handledFieldNames = new Set<string>();
			for (let i = 0; i < tabular.fields.length; i++) {
				const thAttrs = getThAttrs?.(tabular.fields[i], !handledFieldNames.has(tabular.fields[i]));
				handledFieldNames.add(tabular.fields[i]);

				yield `${indent}\t\t\t<th${attrs(thAttrs)}>${quoteHtml(tabular.fieldNames[i])}</th>\n`;
			}

			yield `${indent}\t\t</tr>\n`;
			yield `${indent}\t</thead>\n`;
			yield `${indent}\t<tbody>\n`;
		}

		let beforeEmitted = false;

		if (!leaveEmpty) {
			for (const chunk of generateBefore()) {
				yield chunk;
			}
			beforeEmitted = true;
		}

		for await (const object of streamToIterable(tabular.objects)) {
			if (!beforeEmitted) {
				for (const chunk of generateBefore()) {
					yield chunk;
				}
				beforeEmitted = true;
			}

			yield `${indent}\t\t<tr>\n`;

			for (const valueHtml of Object.values(object)) {
				yield `${indent}\t\t\t<td>${valueHtml}</td>\n`;
			}

			yield `${indent}\t\t</tr>\n`;
		}

		if (beforeEmitted) {
			yield `${indent}\t</tbody>\n`;
			yield `${indent}</table>`;
			if (after) {
				yield after;
			}
		}
	})());
}

export function createTable(database: Database, mapId: ID, filter: string | undefined, hide: string[], url: string): ReadableStream<string> {
	return streamPromiseToStream((async () => {
		const [mapData, types] = await Promise.all([
			database.maps.getMapData(mapId),
			iterableToArray(database.types.getTypes(mapId))
		]);

		if (!mapData) {
			throw new Error(getI18n().t("map-not-found-error", { mapId }));
		}

		return renderTable({
			mapData,
			types,
			renderSingleTable: (typeId, params) => createSingleTable(database, mapId, typeId, filter, hide, params),
			url
		});
	})());
}
