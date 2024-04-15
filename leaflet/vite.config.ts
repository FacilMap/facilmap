/// <reference types="vitest" />

import { defineConfig } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import dtsPlugin from "vite-plugin-dts";
import iconsPlugin from "./rollup-icons";
import { appendFile, readFile } from "fs/promises";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [
		cssInjectedByJsPlugin(),
		dtsPlugin({
			rollupTypes: true,
			tsconfigPath: "./tsconfig.build.json",
			clearPureImport: false,
			async afterBuild() {
				// Due to https://github.com/microsoft/rushstack/issues/1709, our module augmentations are lost during
				// the type rollup. As an ugly workaround, we simply append them here.
				const filterFile = await readFile("./src/type-extensions.ts");
				await appendFile("./dist/facilmap-leaflet.d.ts", filterFile);
			},
		}),
		iconsPlugin(),
		tsconfigPaths({ loose: true })
	],
	build: {
		sourcemap: true,
		minify: false,
		lib: {
			entry: './src/index.ts',
			name: 'facilmap-leaflet',
			fileName: () => 'facilmap-leaflet.mjs',
			formats: ['es']
		},
		rollupOptions: {
			external: (id) => !id.startsWith("./") && !id.startsWith("../") && !id.startsWith("virtual:icons:") && /* resolved internal modules */ !id.startsWith("/")
		}
	},
	resolve: {
		alias: {
			'facilmap-leaflet': './src/index.ts'
		}
	},
	test: {
		environment: 'happy-dom'
	}
});
