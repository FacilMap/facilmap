var gulp = require("gulp");
var gutil = require("gulp-util");
var clean = require("gulp-clean");
var newer = require("gulp-newer");
var combine = require("stream-combiner");
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

gulp.task("icons", function() {
	return combine(
		gulp.src("../bower_components/Open-SVG-Map-Icons/svg/**/*.svg"),
		newer("build/icons.js"),
		icons("icons.js", "angular.module(\"facilmap\").constant(\"fmIcons\", %s);"),
		gulp.dest("build")
	);
});

gulp.task("webpack", [ "icons" ], function(callback) {
    webpackCompiler.run(function(err, stats) {
        if(err) throw new gutil.PluginError("webpack", err);
        gutil.log("[webpack]", stats.toString());
        callback();
    });
});

gulp.task("watch", [ "icons" ], function(callback) {
	webpackCompiler.watch({
	}, function(err, stats) {
        gutil.log("[webpack]", err ? err : stats.toString());
    });
});
