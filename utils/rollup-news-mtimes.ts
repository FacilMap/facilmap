import type { Plugin } from "rollup";
import * as fs from "fs/promises";

export default function newsMtimesPlugin(): Plugin {
	return {
		name: 'virtual:news-mtimes',
		resolveId: (id) => {
			if (['virtual:news-mtimes'].includes(id)) {
				return id;
			}
		},
		load: async (id) => {
			if (id === 'virtual:news-mtimes') {
				const [newsMtime, i18nMtimes] = await Promise.all([
					fs.stat(`${import.meta.dirname}/src/news/news.json`).then((s) => s.mtime.toISOString()),
					fs.readdir(`${import.meta.dirname}/src/news/i18n`).then(async (files) => {
						return Object.fromEntries(await Promise.all(files.map(async (f) => {
							return [f.replace(/\.json$/, ""), await fs.stat(`${import.meta.dirname}/src/news/i18n/${f}`).then((s) => s.mtime.toISOString())];
						})));
					})
				]);

				return `export default ${JSON.stringify({
					news: newsMtime,
					i18n: i18nMtimes
				})};`;
			}
		}
	}
}