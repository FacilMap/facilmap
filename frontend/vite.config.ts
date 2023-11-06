import { defineConfig } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import { fileURLToPath } from "url";
import { paths } from "./build.js";
import vuePlugin from "@vitejs/plugin-vue";

export default defineConfig({
	base: paths.base,
	//appType: "custom",
	plugins: [
		cssInjectedByJsPlugin(),
		vuePlugin()
	],
	assetsInclude: [
		"**/*.ejs"
	],
	build: {
		manifest: true,
		target: ["es2022", "chrome89", "edge89", "safari15", "firefox89", "opera75"],
		rollupOptions: {
			input: {
				map: fileURLToPath(new URL('./src/map/map.ts', import.meta.url)),
				//table: fileURLToPath(new URL('./src/table/table.ts', import.meta.url)),
				//example: fileURLToPath(new URL('./src/example/example.html', import.meta.url)),
			},
			external: [
				"jsdom" // Only actually imported in backend environment
			]
		},
		sourcemap: true,
	},
	test: {
		environment: 'happy-dom'
	}
});
