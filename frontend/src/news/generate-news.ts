import * as fs from "node:fs/promises";
import { createHash } from "node:crypto";

function getChecksum(content: string): string {
	return createHash("sha256").update(content).digest("base64url").slice(0, 8);
}

const changelog = await fs.readFile(`${import.meta.dirname}/../../../CHANGELOG.md`, "utf8");

const split = changelog.split(/^## /m);

const news: Array<{ id: string; date: string }> = [];
const i18n: Record<string, string> = {};

for (let i = 1; i < split.length; i++) {
	const spl = split[i].split("\n");
	const header = spl[0].trim().match(/^([0-9]{4}-[0-9]{2}-[0-9]{2})(: (.*))?$/);
	if (!header) {
		throw new Error(`Unexpected heading format: ${spl[0].trim()}"`);
	}

	const date = header[1];
	const heading = header[3].trim();

	const content = spl.slice(1).join("\n").trim();
	const id = getChecksum(`${date}\n${heading}\n${content}`);

	news.push({ id, date });
	i18n[`${date}-${id}-heading`] = heading;
	i18n[`${date}-${id}-content`] = content;
}

await Promise.all([
	fs.writeFile(`${import.meta.dirname}/news.json`, JSON.stringify(news, undefined, "\t")),
	fs.writeFile(`${import.meta.dirname}/i18n/en.json`, JSON.stringify({ news: i18n }, undefined, "\t"))
]);