import { defineConfig } from "vite";
import dtsPlugin from "vite-plugin-dts";

export default defineConfig({
	plugins: [
		dtsPlugin({ rollupTypes: true })
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
			external: (id) => !id.startsWith("./") && !id.startsWith("../") && /* resolved internal modules */ !id.startsWith("/")
		}
	}
});
