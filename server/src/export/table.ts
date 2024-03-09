import type { ID, PadId } from "facilmap-types";
import { quoteHtml } from "facilmap-utils";
import Database from "../database/database.js";
import { renderTable } from "../frontend.js";
import { ReadableStream } from "stream/web";
import { asyncIteratorToArray, asyncIteratorToStream, streamPromiseToStream } from "../utils/streams.js";
import { getTabularData } from "./tabular.js";

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
	padId: PadId,
	typeId: ID,
	filter?: string,
	hide: string[] = [],
	{ indent = "", tableAttrs, getThAttrs, before, after, leaveEmpty }: TableParams = {}
): ReadableStream<string> {
	return asyncIteratorToStream((async function* () {
		function attrs(a: Record<string, string> = {}) {
			return Object.entries(a).map(([k, v]) => ` ${quoteHtml(k)}="${quoteHtml(v)}"`).join("");
		}

		const tabular = await getTabularData(database, padId, typeId, true, filter, hide);

		function* generateBefore() {
			if (before) {
				yield `${before}`;
			}

			yield `${indent}<table${attrs(tableAttrs)}>\n`;
			yield `${indent}\t<thead>\n`;
			yield `${indent}\t\t<tr>\n`;

			let handledFieldNames = new Set<string>();
			for (const field of tabular.fields) {
				const thAttrs = getThAttrs?.(field, !handledFieldNames.has(field));
				handledFieldNames.add(field);

				yield `${indent}\t\t\t<th${attrs(thAttrs)}>${quoteHtml(field)}</th>\n`;
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

		for await (const object of tabular.objects) {
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

export function createTable(database: Database, padId: PadId, filter: string | undefined, hide: string[]): ReadableStream<string> {
	return streamPromiseToStream((async () => {
		const [padData, types] = await Promise.all([
			database.pads.getPadData(padId),
			asyncIteratorToArray(database.types.getTypes(padId))
		]);

		return renderTable({
			padData,
			types,
			renderSingleTable: (typeId, params) => createSingleTable(database, padId, typeId, filter, hide, params)
		});
	})());
}
