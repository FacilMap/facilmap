const isNode = typeof global !== "undefined" && ({}).toString.call(global) === '[object global]'; // https://stackoverflow.com/a/38815760/242365

let filtrexFile;
if (isNode)
	filtrexFile = eval("require")("fs").readFileSync(require.resolve("filtrex/filtrex"), { encoding: "utf8" });
else // Webpack
	filtrexFile = require("raw-loader!filtrex/filtrex");

const compileExpression = eval(`
	(function() {
		${filtrexFile}
		return compileExpression;
	})()
`);

module.exports = compileExpression;