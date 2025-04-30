import type { Type } from "facilmap-types";
import { quoteHtml } from "facilmap-utils";
import { renderTable } from "../frontend.js";
import { iterableToArray, iterableToStream, streamPromiseToStream, streamToIterable, StringAggregationTransformStream } from "../utils/streams.js";
import { getTabularData } from "./tabular.js";
import type { RawActiveMapLink } from "../utils/permissions.js";
import type { ApiV3Backend } from "../api/api-v3.js";

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
	api: ApiV3Backend,
	mapLink: RawActiveMapLink,
	type: Type,
	filter?: string,
	hide: string[] = [],
	{ indent = "", tableAttrs, getThAttrs, before, after, leaveEmpty }: TableParams = {}
): ReadableStream<string> {
	return iterableToStream((async function* () {
		function attrs(a: Record<string, string> = {}) {
			return Object.entries(a).map(([k, v]) => ` ${quoteHtml(k)}="${quoteHtml(v)}"`).join("");
		}

		const tabular = await getTabularData(api, mapLink, type, true, filter, hide);

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
	})()).pipeThrough(new StringAggregationTransformStream());
}

export function createTable(api: ApiV3Backend, mapLink: RawActiveMapLink, filter: string | undefined, hide: string[], url: string): ReadableStream<string> {
	return streamPromiseToStream((async () => {
		const [mapData, types] = await Promise.all([
			api.getMap(mapLink),
			iterableToArray((await api.getMapTypes(mapLink)).results)
		]);

		return renderTable({
			mapData,
			types,
			renderSingleTable: (type, params) => createSingleTable(api, mapLink, type, filter, hide, params),
			url
		});
	})());
}
