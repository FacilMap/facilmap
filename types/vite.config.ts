import { defineConfig } from 'vite';
import dtsPlugin from 'vite-plugin-dts';
import autoExternalPlugin from 'rollup-plugin-auto-external';

export default defineConfig({
	plugins: [
		dtsPlugin({ rollupTypes: true }),
		autoExternalPlugin()
	],
	build: {
		sourcemap: true,
		minify: false,
		target: "esnext",
		lib: {
			entry: './src/index.ts',
			name: 'facilmap-types',
			fileName: () => 'facilmap-types.mjs',
			formats: ['es']
		}
	}
});
