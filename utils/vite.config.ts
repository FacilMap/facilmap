import { defineConfig } from "vite";
import dtsPlugin from "vite-plugin-dts";

export default defineConfig({
	plugins: [
		dtsPlugin({ rollupTypes: true })
	],
	build: {
		sourcemap: true,
		minify: false,
		target: "esnext",
		lib: {
			entry: './src/index.ts',
			name: 'facilmap-utils',
			fileName: () => 'facilmap-utils.mjs',
			formats: ['es']
		},
		rollupOptions: {
			external: (id) => !id.startsWith("./") && !id.startsWith("../") && /* resolved internal modules */ !id.startsWith("/")
		}
	}
});
