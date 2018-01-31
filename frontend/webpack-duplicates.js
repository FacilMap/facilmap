// Detect if multiple versions of the same yarn dependency are pulled in

module.exports = class WebpackDuplicateModulesPlugin {
	apply(compiler) {
		let modulePaths = {};

		compiler.plugin('compilation', function(compilation, params) {
			compilation.plugin('after-optimize-chunk-assets', function(chunks) {
				for(let chunk of chunks) {
					chunk.forEachModule((file) => {
						let module = file.resource && file.resource.match(/^.*\/node_modules\/([^/]+)\//);
						if(module) {
							if(!modulePaths[module[1]])
								modulePaths[module[1]] = new Set();

							modulePaths[module[1]].add(module[0]);
						}
					});
				}
			});
		});

		compiler.plugin('done', function() {
			for(let module in modulePaths) {
				if(modulePaths[module].size > 1) {
					console.warn(`Warning: Multiple paths for module ${module}: ${Array.from(modulePaths[module])}`);
				}
			}
		});
	}
};