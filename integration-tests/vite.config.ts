import { defineConfig } from "vite";
import dtsPlugin from "vite-plugin-dts";
import tsconfigPaths from "vite-tsconfig-paths";
import { isAbsolute } from "node:path";

export default defineConfig({
	plugins: [
		dtsPlugin({ rollupTypes: true }),
		tsconfigPaths({ loose: true })
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
		},
		rollupOptions: {
			external: (id) => (
				!id.startsWith("./")
				&& !id.startsWith("../")
				&& /* resolved internal modules */ !isAbsolute(id)
				&& !["facilmap-types", "facilmap-utils"].includes(id)
			)
		}
	},
	test: {
		testTimeout: 20_000
	}
});
