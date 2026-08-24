import type { Plugin } from "rollup";
import glob from "fast-glob";
import { readFile } from "fs/promises";
import { createRequire } from "module";
import { dirname } from "path";
import { fileURLToPath } from "url";

// https://stackoverflow.com/a/62499498/242365
const require = createRequire(import.meta.url);

const coreIcons = [
	"align-left", "arrow-left", "arrow-right", "car", "fa-check", "chart-line", "check", "chevron-right", "circle-info", "code",
	"cog", "copy", "eraser", "heading", "image", "info-sign", "link", "link-slash", "list-check", "list-ol", "list-ul",
	"menu-hamburger", "minus", "new-window", "object-group", "object-ungroup", "person-biking",
	"person-walking", "plus", "question-sign", "qrcode", "quote-left", "remove", "resize-horizontal", "resize-vertical",
	"screenshot", "search", "shuffle", "slash", "square", "square-plus", "square-minus", "strikethrough", "subscript",
	"superscript", "table", "trash", "triangle-bottom", "triangle-top", "unchecked", "zoom-in"
];

async function getIconFilenames(): Promise<Record<string, Record<string, string>>> {
	const icons: Record<string, Record<string, string>> = {};

	for (const path of await glob(`${dirname(fileURLToPath(import.meta.url))}/assets/icons/*/*.svg`)) {
		const [set, fname] = path.split("/").slice(-2);

		if (!icons[set])
			icons[set] = {};

		icons[set][fname.replace(/\.svg$/, "")] = path;
	}

	icons["fontawesome"] = {};
	for (const name of [
		"align-left", "arrow-left", "arrow-right", "person-biking", "car", "chart-line", ["check", "fa-check"], "code", "copy", "circle-info",
		"eraser", "heading", "image", "link", "link-slash", "list-check", "list-ol", "list-ul", "object-group",
		"object-ungroup", "person-walking", "quote-left", "shuffle", "slash",
		"square", "square-plus", "square-minus", "strikethrough", "subscript", "superscript", "table", "trash"
	]) {
		const [name1, name2] = Array.isArray(name) ? name : [name, name];
		icons["fontawesome"][name2] = require.resolve(`@fortawesome/fontawesome-free/svgs/solid/${name1}.svg`);
	}

	return icons;
}

function pickIcons(icons: Record<string, Record<string, string>>, pick: (set: string, key: string) => boolean): Record<string, Record<string, string>> {
	return Object.fromEntries(Object.entries(icons).map(([k1, v2]) => (
		[k1, Object.fromEntries(Object.entries(v2).filter(([k2]) => pick(k1, k2)))]
	)));
}

async function getIcons(iconFilenames: Record<string, Record<string, string>>): Promise<Record<string, Record<string, string>>> {
	const icons: Record<string, Record<string, string>> = {};
	for (const [set, fnames] of Object.entries(iconFilenames)) {
		icons[set] = {};
		for (const [key, fname] of Object.entries(fnames)) {
			icons[set][key] = (await readFile(fname)).toString();
		}
	}
	return icons;
}

export default function iconPlugin(): Plugin {
	return {
		name: 'virtual:icons',
		resolveId: (id) => {
			if (['virtual:icons:core', 'virtual:icons:extra', 'virtual:icons:keys'].includes(id)) {
				return id;
			}
		},
		load: async (id) => {
			if (id === 'virtual:icons:keys') {
				const iconFilenames = await getIconFilenames();
				const icons = Object.fromEntries(Object.entries(iconFilenames).map(([set, fnames]) => [set, Object.keys(fnames)]));
				return (
					`export const coreIconKeys = ${JSON.stringify(coreIcons)};\n\n` +
					`export default ${JSON.stringify(icons, undefined, '\t')}`
				);
			} else if (id === 'virtual:icons:core') {
				const iconFilenames = pickIcons(await getIconFilenames(), (set, key) => coreIcons.includes(key));
				const icons = await getIcons(iconFilenames);
				return `export default ${JSON.stringify(icons, undefined, '\t')}`;
			} else if (id === 'virtual:icons:extra') {
				const iconFilenames = pickIcons(await getIconFilenames(), (set, key) => !coreIcons.includes(key));
				const icons = await getIcons(iconFilenames);
				return `export default ${JSON.stringify(icons, undefined, '\t')}`;
			}
		}
	}
}