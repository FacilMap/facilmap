import { defineConfig } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import dtsPlugin from "vite-plugin-dts";
import autoExternalPlugin from "rollup-plugin-auto-external";
import iconsPlugin from "./rollup-icons";

export default defineConfig({
	plugins: [
		cssInjectedByJsPlugin(),
		dtsPlugin({ rollupTypes: true, clearPureImport: false }),
		autoExternalPlugin(),
		iconsPlugin()
	],
	build: {
		sourcemap: true,
		minify: false,
		lib: {
			entry: './src/index.ts',
			name: 'facilmap-leaflet',
			fileName: () => 'facilmap-leaflet.mjs',
			formats: ['es']
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
