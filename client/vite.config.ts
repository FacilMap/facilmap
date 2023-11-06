import { defineConfig } from "vite";
import dtsPlugin from "vite-plugin-dts";
import autoExternalPlugin from "rollup-plugin-auto-external";

export default defineConfig({
	plugins: [
		dtsPlugin({ rollupTypes: true }),
		autoExternalPlugin()
	],
	build: {
		sourcemap: true,
		minify: false,
		lib: {
			entry: './src/client.ts',
			fileName: () => 'facilmap-client.mjs',
			formats: ['es']
		}
	}
});
