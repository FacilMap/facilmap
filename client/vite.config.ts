import { defineConfig } from 'vite';
import dtsPlugin from 'vite-plugin-dts';
import autoExternalPlugin from 'rollup-plugin-auto-external';

export default defineConfig({
	plugins: [
		dtsPlugin(),
		autoExternalPlugin()
	],
	build: {
		sourcemap: true,
		minify: false,
		lib: {
			entry: './src/client.ts',
			fileName: () => 'client.mjs',
			formats: ['es']
		}
	}
});
