import { esrun } from "@digitak/esrun";

// esbuild --bundle --platform=node --packages=external --format=esm src/server.ts --loader:.ejs=text --sourcemap=inline --outfile=dist/facilmap-server.mjs

await esrun("./esrun-server.ts", {
	esbuildOptions: {
		loader: {
			".ejs": "text"
		},
		packages: "external",
		sourceRoot: `${process.cwd()}/`, // https://github.com/digital-loukoum/esrun/issues/41
		// sourcemap: false,
	},
	sendCodeMode: "temporaryFile",
	// Uncomment this to inspect the temporary file:
	// afterRun: () => {
	// 	process.exit();
	// }
});
