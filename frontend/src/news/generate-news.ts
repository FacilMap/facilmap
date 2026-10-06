import { load } from "cheerio";
import { markdownBlock } from "facilmap-utils";
import * as fs from "node:fs/promises";
import { createHash } from "node:crypto";

function getChecksum(content: string): string {
	return createHash("sha256").update(content).digest("base64url").slice(0, 8);
}

const changelog = await fs.readFile(`${import.meta.dirname}/../../../CHANGELOG.md`, "utf8");

const $ = load("<div/>");
const el = $.root();

el.html(markdownBlock(changelog, true));

const parts: Array<{ date: string; content: string }> = []
let cur: { date: string; content: string } | undefined;
for (const child of el.children()) {
	if (child.tagName === "h2") {
		const date = $(child).text();
		if (!date.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)) {
			console.warn(`Unexpected date format: ${date}`);
		}
		cur = { date: $(child).text(), content: "" };
		parts.push(cur);
	} else if (cur) {
		cur.content += $.html(child);
	}
}

const news: Array<{ id: string; date: string }> = [];
const i18n: Record<string, string> = {};
for (const part of parts) {
	const id = getChecksum(part.content);
	news.push({ id, date: part.date });
	i18n[`${part.date}_${id}`] = part.content;
}

await Promise.all([
	fs.writeFile(`${import.meta.dirname}/news.json`, JSON.stringify(news, undefined, "\t")),
	fs.writeFile(`${import.meta.dirname}/i18n/en.json`, JSON.stringify(i18n, undefined, "\t"))
]);