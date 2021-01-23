var gulp = require("gulp");
var gutil = require("gulp-util");
var clean = require("gulp-clean");
var newer = require("gulp-newer");
var fs = require("fs");
var request = require("request-promise");
var unzip = require("unzipper");
var webpack = require("webpack");
var util = require("util");

var icons = require("./gulpfile-icons");
var webpackConfig = require("./webpack.config.js");

let webpackCompiler = webpack(webpackConfig);

const staticFrontendFile = `${__dirname}/build/frontend.js`;
const staticClientFile = `${__dirname}/build/client.js`;

function pipe(source, ...transformers) {
	let current = source;
	for (const transformer of transformers) {
		current.on("error", (e) => {
			transformer.emit("error", e);
		});
		current = current.pipe(transformer);
	}
	return current;
}

function doClean() {
	return pipe(
		gulp.src("build"),
		clean()
	);
}

async function fileExists(filename) {
	try {
		await fs.promises.stat(filename);
		return true;
	} catch (err) {
		if (err.code === 'ENOENT') {
			return false;
		} else {
			throw error;
		}
	}
}

const doIcons = gulp.series(downloadIcons, compileIcons);

async function doWebpack() {
	const stats = await util.promisify(webpackCompiler.run.bind(webpackCompiler))();
	gutil.log("[webpack]", stats.toString());

	if(stats.compilation.errors && stats.compilation.errors.length > 0)
		throw new gutil.PluginError("webpack", "There were compilation errors.");

	if (await fileExists(staticFrontendFile))
		await fs.promises.unlink(staticFrontendFile);
	
	// Create symlink with fixed file name so that people can include https://facilmap.org/frontend.js
	await fs.promises.symlink(`frontend-index-${stats.hash}.js`, `${__dirname}/build/frontend.js`);
}

async function doSymlinks() {
	// Create symlink to facilmap-client so that people can include https://facilmap.org/client.js
	if (!await fileExists(staticClientFile))
		await fs.promises.symlink(require.resolve("facilmap-client/dist/client"), staticClientFile);
}

function doWatch() {
	webpackCompiler.watch({
	}, function(err, stats) {
        gutil.log("[webpack]", err ? err : stats.toString());
	});
}

module.exports.default = gulp.series(doIcons, doWebpack, doSymlinks);
module.exports.icons = doIcons;
module.exports.watch = gulp.series(doIcons, doWatch);
module.exports.clean = doClean;