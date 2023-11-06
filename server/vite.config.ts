import { defineConfig } from "vite";
import dtsPlugin from "vite-plugin-dts";
import autoExternalPlugin from "rollup-plugin-auto-external";

export default defineConfig({
	plugins: [
		dtsPlugin({ rollupTypes: true }),
		autoExternalPlugin()
	],
	build: {
		sourcemap: false,
		minify: false,
		target: "esnext",
		lib: {
			entry: './src/server.ts',
			name: 'facilmap-server',
			fileName: () => 'facilmap-server.mjs',
			formats: ['es']
		}
	}
});
