import { defineConfig } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import dtsPlugin from 'vite-plugin-dts';
import autoExternalPlugin from 'rollup-plugin-auto-external';

export default defineConfig(({ mode }) => ({
	plugins: [
		cssInjectedByJsPlugin(),
		dtsPlugin({ rollupTypes: true }),
		autoExternalPlugin(),
	],
	build: {
		sourcemap: true,
		minify: false,
		lib: {
			entry: './src/lib/index.ts',
			name: 'facilmap-frontend',
			fileName: () => 'facilmap-frontend.mjs',
			formats: ['es']
		}
	}
}));
