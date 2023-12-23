import type { Plugin } from "vite";
import { readFile } from "fs/promises";

export default function definePlugin(): Plugin {
	return {
		name: "FacilMap define",
		config: async (config) => {
			const packageJson = JSON.parse(await readFile(new URL("./package.json", import.meta.url), "utf8"));
			config.define = config.define ?? {};
			config.define["__FM_VERSION__"] = JSON.stringify(packageJson.version);
		}
	};
}