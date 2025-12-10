import type { Plugin } from "rollup";
import glob from "fast-glob";
import { access, readFile, readdir, writeFile } from "fs/promises";
import { createRequire } from "module";
import { dirname } from "path";
import { fileURLToPath } from "url";
import findCacheDir from "find-cache-dir";

const cacheDir = findCacheDir({ name: "facilmap-utils", create: true })
	|| findCacheDir({ name: "facilmap-utils", create: true, cwd: fileURLToPath(new URL('./', import.meta['url'])) })!;
const cacheFile = `${cacheDir}/languages.json`;

async function getAllLanguages(): Promise<Set<string>> {
	const result = new Set<string>();
	for (const dir of [
		fileURLToPath(new URL('./src/i18n', import.meta['url'])),
		fileURLToPath(new URL('../frontend/src/i18n', import.meta['url'])),
		fileURLToPath(new URL('../leaflet/src/i18n', import.meta['url'])),
		fileURLToPath(new URL('../server/src/i18n', import.meta['url'])),
		fileURLToPath(new URL('../utils/src/i18n', import.meta['url']))
	]) {
		for (const file of await readdir(dir)) {
			const m = file.match(/([^/\\]*)\.json$/i);
			if (m) {
				result.add(m[1]);
			}
		}
	}
	return result;
}

async function downloadLanguageNames(languages: Set<string>): Promise<Record<string, string>> {
	const result: Record<string, string> = {};
	for (const language of languages) {
		const lang = language.replaceAll("-", "_");
		const url = `https://raw.githubusercontent.com/umpirsky/language-list/refs/heads/master/data/${encodeURIComponent(lang)}/language.json`;
		console.log(`Fetching ${url}`);
		const res = await fetch(url);
		if (!res.ok) {
			throw new Error(`Could not fetch ${res.url} (status ${res.status})`);
		}
		const json = await res.json();

		if (Object.hasOwn(json, lang)) {
			result[language] = json[lang];
		} else {
			const shortLang = lang.split("_")[0];
			if (Object.hasOwn(json, shortLang)) {
				result[language] = json[shortLang];
			} else {
				throw new Error(`Language name for ${lang} not found`);
			}
		}

		result[language] = `${result[language][0].toLocaleUpperCase(language)}${result[language].slice(1)}`;
	}
	return result;
}

export async function fileExists(filename: string): Promise<boolean> {
	try {
		await access(filename);
		return true;
	} catch (err: any) {
		if (err.code === 'ENOENT') {
			return false;
		} else {
			throw err;
		}
	}
}

async function getCachedLanguageNames(): Promise<Record<string, string>> {
	const languages = await getAllLanguages();

	if (await fileExists(cacheFile)) {
		const result = JSON.parse(await readFile(cacheFile, "utf8"));
		if ([...languages].every((lang) => Object.hasOwn(result, lang))) {
			return result;
		}
	}

	const result = await downloadLanguageNames(languages);
	await writeFile(cacheFile, JSON.stringify(result));
	return result;
}

export default function languagesPlugin(): Plugin {
	return {
		name: "virtual:languages",
		resolveId: (id) => {
			if (id === "virtual:languages") {
				return id;
			}
		},
		load: async (id) => {
			if (id === "virtual:languages") {
				const languageNames = await getCachedLanguageNames();
				return `export default ${JSON.stringify(languageNames)}`;
			}
		}
	}
}