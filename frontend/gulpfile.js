var async = require("async");
var es = require("event-stream");
var fs = require("fs");
var gulp = require("gulp");
var templateCache = require("gulp-angular-templatecache");
var clean = require("gulp-clean");
var concat = require("gulp-concat");
var cssBase64 = require("gulp-css-base64");
var gulpIf = require("gulp-if");
var minifyCss = require("gulp-minify-css");
var newer = require("gulp-newer");
var ngAnnotate = require("gulp-ng-annotate");
var replace = require("gulp-replace");
var uglify = require("gulp-uglify");
var mainBowerFiles = require("main-bower-files");
var combine = require("stream-combiner");

var files = [
	"js/*.js",
	"css/*.css",
	"templates/*.html"
];

var deps = mainBowerFiles();

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
			gulp.src("lib/**/*")
		]),
		gulpIf([ "**/*.js", "**/*.css" ], combine(
			gulpIf("**/*.js", combine(
				newer("build/dependencies.js"),
				concat("dependencies.js"),
				uglify()
			)),
			gulpIf("**/*.css", combine(
				newer("build/dependencies.css"),
				concat("dependencies.css"),
				minifyCss()
			)),
			gulp.dest("build")
		))
	);
});

gulp.task("app", function() {
	return combine(
		gulp.src(files, { base: process.cwd() + "/" }),
		gulpIf("**/*.html", templateCache({ module: "facilpad", base: process.cwd() + "/templates/" })),
		gulpIf("**/*.js", combine(
			newer("build/app.js"),
			concat("app.js"),
			ngAnnotate(),
			uglify()
		)),
		gulpIf("**/*.css", combine(
			newer("build/app.css"),
			cssBase64({ maxWeightResource: 1000000 }),
			concat("app.css"),
			minifyCss()
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
						concat("all.js")
					),
					combine(
						gulp.src([ "build/dependencies.css", "build/app.css" ]),
						concat("all.css")
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