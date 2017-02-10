var gulp = require("gulp");
var gutil = require("gulp-util");
var clean = require("gulp-clean");
var newer = require("gulp-newer");
var combine = require("stream-combiner");
var fs = require("fs");
var Promise = require("promise");
var request = require("request-promise");
var unzip = require("unzipper");
var webpack = require("webpack");

var icons = require("./gulpfile-icons");
var webpackConfig = require("./webpack.config.js");

let webpackCompiler = webpack(webpackConfig);

gulp.task("default", [ "webpack" ]);

gulp.task("clean", function() {
	return combine(
		gulp.src("build"),
		clean()
	);
});

gulp.task("download-icons", function() {
	return new Promise((resolve, reject) => {
		fs.exists("build/Open-SVG-Map-Icons", (exists) => {
			resolve(exists);
		});
	}).then((exists) => {
		if(exists)
			return;

		let extract = unzip.Extract({
			path: "build/"
		});

		let download = request.get("https://github.com/twain47/Open-SVG-Map-Icons/archive/master.zip");
		download.pipe(extract);
		download.catch((err) => {
			extract.emit("error", err);
		});

		return extract.promise().then(() => {
			return Promise.denodeify(fs.rename)("build/Open-SVG-Map-Icons-master", "build/Open-SVG-Map-Icons");
		});
	});
});

gulp.task("icons", ["download-icons"], function() {
	return combine(
		gulp.src("build/Open-SVG-Map-Icons/svg/**/*.svg"),
		newer("build/icons.js"),
		icons("icons.js", "angular.module(\"facilmap\").constant(\"fmIcons\", %s);"),
		gulp.dest("build")
	);
});

gulp.task("webpack", [ "icons" ], function() {
	return Promise.denodeify(webpackCompiler.run.bind(webpackCompiler))().then(function(stats) {
		gutil.log("[webpack]", stats.toString());

		if(stats.compilation.errors && stats.compilation.errors.length > 0)
			throw new gutil.PluginError("webpack", "There were compilation errors.");
    });
});

gulp.task("watch", [ "icons" ], function() {
	webpackCompiler.watch({
	}, function(err, stats) {
        gutil.log("[webpack]", err ? err : stats.toString());
    });
});
