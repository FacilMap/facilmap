import { defineConfig } from "vite";
import dtsPlugin from "vite-plugin-dts";
import tsconfigPaths from "vite-tsconfig-paths";
import { isAbsolute } from "node:path";
import languagesPlugin from "facilmap-utils/rollup-languages";

export default defineConfig({
	plugins: [
		dtsPlugin({ rollupTypes: true, tsconfigPath: "./tsconfig.build.json" }),
		tsconfigPaths({ loose: true }),
		languagesPlugin()
	],
	build: {
		sourcemap: false,
		minify: false,
		target: "esnext",
		lib: {
			entry: './src/index.ts',
			name: 'facilmap-server',
			fileName: () => 'facilmap-server.mjs',
			formats: ['es']
		},
		rollupOptions: {
			external: (id) => (
				!id.startsWith("./")
				&& !id.startsWith("../")
				&& /* resolved internal modules */ !isAbsolute(id)
				&& !["facilmap-types", "facilmap-utils"].includes(id)
			)
		}
	}
});
