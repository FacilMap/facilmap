import { defineConfig } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import dtsPlugin from 'vite-plugin-dts';
import autoExternalPlugin from 'rollup-plugin-auto-external';
import iconsPlugin from "./rollup-icons";

export default defineConfig({
	plugins: [
		cssInjectedByJsPlugin(),
		dtsPlugin(),
		autoExternalPlugin(),
		iconsPlugin()
	],
	build: {
		sourcemap: true,
		minify: false,
		lib: {
			entry: './src/index.ts',
			name: 'L.FacilMap',
			fileName: () => 'L.FacilMap.mjs',
			formats: ['es']
		}
	},
	resolve: {
		alias: {
			'facilmap-leaflet': './src/index.ts'
		}
	}
});
