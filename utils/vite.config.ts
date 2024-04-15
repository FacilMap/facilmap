/// <reference types="vitest" />
import { defineConfig } from "vite";
import dtsPlugin from "vite-plugin-dts";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [
		tsconfigPaths({ loose: true }),
		dtsPlugin({ rollupTypes: true, tsconfigPath: "./tsconfig.build.json" })
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
			external: (id) => id.includes("/node_modules/") || (!id.startsWith("./") && !id.startsWith("../") && /* resolved internal modules */ !id.startsWith("/"))
		}
	},
	test: {
		server: {
			deps: {
				external: [/\/node_modules\//] // Temporary fix for https://discord.com/channels/917386801235247114/1215127757550260225
			}
		}
	}
});
