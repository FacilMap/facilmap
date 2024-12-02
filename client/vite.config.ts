import { defineConfig } from "vite";
import dtsPlugin from "vite-plugin-dts";
import { isAbsolute } from "node:path";

export default defineConfig({
	plugins: [
		dtsPlugin({ rollupTypes: true, tsconfigPath: "./tsconfig.build.json" }),
	],
	build: {
		sourcemap: true,
		minify: false,
		lib: {
			entry: './src/client.ts',
			fileName: () => 'facilmap-client.mjs',
			formats: ['es']
		},
		rollupOptions: {
			external: (id) => !id.startsWith("./") && !id.startsWith("../") && /* resolved internal modules */ !isAbsolute(id)
		}
	}
});
