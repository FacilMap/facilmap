var async = require("async");
var es = require("event-stream");
var fs = require("fs");
var gulp = require("gulp");
var templateCache = require("gulp-angular-templatecache");
var clean = require("gulp-clean");
var concat = require("gulp-concat");
var cssBase64 = require("gulp-css-base64");
var gulpIf = require("gulp-if");
var cleanCss = require("gulp-clean-css");
var newer = require("gulp-newer");
var ngAnnotate = require("gulp-ng-annotate");
var replace = require("gulp-replace");
var uglify = require("gulp-uglify");
var mainBowerFiles = require("main-bower-files");
var combine = require("stream-combiner");
var sourcemaps = require("gulp-sourcemaps");

var files = [
	"app/**/*.js",
	"app/**/*.css",
	"app/**/*.html"
];

var deps = mainBowerFiles().filter(function(it) {
	return !it.match(/\/bower_components\/(jquery|jquery-ui)\//);
});

gulp.task("default", [ "all" ]);

gulp.task("clean", function() {
	return combine(
		gulp.src("build"),
		clean()
	);
});

gulp.task("deps", function() {
	return combine(
		es.merge([
			gulp.src(deps, { base: process.cwd() + "/" }),
			gulp.src("assets/libs/**/*")
		]),
		gulpIf([ "**/*.js", "**/*.css" ], combine(
			gulpIf("**/*.js", combine(
				newer("build/dependencies.js"),
				sourcemaps.init(),
				concat("dependencies.js"),
				uglify(),
				sourcemaps.write("./sourcemaps")
			)),
			gulpIf("**/*.css", combine(
				newer("build/dependencies.css"),
				sourcemaps.init(),
				concat("dependencies.css"),
				cleanCss(),
				sourcemaps.write("./sourcemaps")
			)),
			gulp.dest("build")
		))
	);
});

gulp.task("app", function() {
	return combine(
		gulp.src(files, { base: process.cwd() + "/" }),
		gulpIf("**/*.html", templateCache({ module: "facilpad", base: process.cwd() + "/app/" })),
		gulpIf("**/*.js", combine(
			newer("build/app.js"),
			sourcemaps.init(),
			concat("app.js"),
			ngAnnotate(),
			uglify(),
			sourcemaps.write("./sourcemaps")
		)),
		gulpIf("**/*.css", combine(
			newer("build/app.css"),
			cssBase64({ maxWeightResource: 1000000 }),
			sourcemaps.init(),
			concat("app.css"),
			cleanCss(),
			sourcemaps.write("./sourcemaps")
		)),
		gulp.dest("build")
	);
});

gulp.task("all", [ "deps", "app" ], function(callback) {
	async.series([
		function(next) {
			combine(
				es.merge(
					combine(
						gulp.src([ "build/dependencies.js", "build/app.js" ]),
						sourcemaps.init({ loadMaps: true }),
						concat("all.js"),
						sourcemaps.write("./sourcemaps")
					),
					combine(
						gulp.src([ "build/dependencies.css", "build/app.css" ]),
						sourcemaps.init({ loadMaps: true }),
						concat("all.css"),
						sourcemaps.write("./sourcemaps")
					)
				),
				gulp.dest("build"),
				es.wait(next)
			);
		}/*, function(next) {
			combine(
				gulp.src("index.html"),
				replace("<!-- inject:css -->", "<style>" + fs.readFileSync("build/all.css") + "</style>"),
				replace("<!-- inject:js -->", "<script>" + fs.readFileSync("build/all.js") + "</script>"),
				replace("<!-- endinject -->", ""),
				gulp.dest("build"),
				es.wait(next)
			);
		}*/
	], callback);
});

gulp.task("watch", [ "all" ], function() {
	gulp.watch([ "index.html" ].concat(files), [ "all" ]);
});