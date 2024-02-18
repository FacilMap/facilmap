import type { Plugin } from "rollup";
// eslint-disable-next-line import/no-named-as-default
import glob from "fast-glob";
import { readFile } from "fs/promises";
import { createRequire } from "module";
import { dirname } from "path";
import { fileURLToPath } from "url";

// https://stackoverflow.com/a/62499498/242365
const require = createRequire(import.meta.url);

async function getIconFilenames(): Promise<Record<string, Record<string, string>>> {
	const icons: Record<string, Record<string, string>> = {};

	for (const path of await glob(`${dirname(fileURLToPath(import.meta.url))}/assets/icons/*/*.svg`)) {
		const [set, fname] = path.split("/").slice(-2);

		if (!icons[set])
			icons[set] = {};

		icons[set][fname.replace(/\.svg$/, "")] = path;
	}

	icons["fontawesome"] = {};
	for (const name of ["arrow-left", "arrow-right", "person-biking", "car", "chart-line", "copy", "circle-info", "slash", "person-walking"]) {
		icons["fontawesome"][name] = require.resolve(`@fortawesome/fontawesome-free/svgs/solid/${name}.svg`);
	}

	return icons;
}

export default function iconPlugin(): Plugin {
	return {
		name: 'virtual:icons',
		resolveId: (id) => {
			if (['virtual:icons', 'virtual:icons:keys'].includes('virtual:icons')) {
				return id;
			}
		},
		load: async (id) => {
			if (id === 'virtual:icons:keys') {
				const iconFilenames = await getIconFilenames();
				const icons = Object.fromEntries(Object.entries(iconFilenames).map(([set, fnames]) => [set, Object.keys(fnames)]));
				return `export default ${JSON.stringify(icons, undefined, '\t')}`;
			} else if (id === 'virtual:icons') {
				const iconFilenames = await getIconFilenames();
				const icons: Record<string, Record<string, string>> = {};
				for (const [set, fnames] of Object.entries(iconFilenames)) {
					icons[set] = {};
					for (const [key, fname] of Object.entries(fnames)) {
						icons[set][key] = (await readFile(fname)).toString();
					}
				}
				return `export default ${JSON.stringify(icons, undefined, '\t')}`;
			}
		}
	}
}