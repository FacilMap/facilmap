import { defineConfig } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import dtsPlugin from "vite-plugin-dts";
import vuePlugin from "@vitejs/plugin-vue";
import tsconfigPaths from "vite-tsconfig-paths";
import definePlugin from "./vite-define";

export default defineConfig(({ mode }) => ({
	plugins: [
		cssInjectedByJsPlugin(),
		dtsPlugin({ rollupTypes: true }),
		vuePlugin(),
		tsconfigPaths(),
		definePlugin()
	],
	build: {
		outDir: "./dist/lib",
		sourcemap: true,
		minify: false,
		lib: {
			entry: './src/lib/index.ts',
			name: 'facilmap-frontend',
			fileName: () => 'facilmap-frontend.mjs',
			formats: ['es']
		},
		rollupOptions: {
			external: (id) => !id.startsWith("./") && !id.startsWith("../") && /* resolved internal modules */ !id.startsWith("/")
		}
	}
}));
