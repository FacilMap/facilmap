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
var inject = require("gulp-inject");
var img64 = require("./gulpfile-img64");
var path = require("path");

var files = [
	"app/**/*.js",
	"app/**/*.css",
	"app/**/*.html",
	"assets/**/*.css"
];

gulp.task("default", [ "index" ]);

gulp.task("clean", function() {
	return combine(
		gulp.src("build"),
		clean()
	);
});

gulp.task("deps", function() {
	return combine(
		gulp.src(mainBowerFiles({ paths: { bowerDirectory: __dirname + '/../bower_components', bowerJson: __dirname + '/../bower.json' } }), { base: path.resolve(__dirname + "/..") + "/" }),
		gulpIf([ "**/*.js", "**/*.css" ], combine(
			gulpIf("**/*.js", combine(
				newer("build/dependencies.js"),
				sourcemaps.init({ loadMaps: true }),
				concat("dependencies.js"),
				uglify(),
				sourcemaps.write("./sourcemaps")
			)),
			gulpIf("**/*.css", combine(
				newer("build/dependencies.css"),
				gulpIf("**/bower_components/bootstrap/**", combine(
					replace("src: url('../fonts/glyphicons-halflings-regular.eot');", ""),
					replace(/src: url\('\.\.\/fonts\/glyphicons-halflings-regular\..*/g, "src: url('../fonts/glyphicons-halflings-regular.ttf') format('truetype');")
				)),
				cssBase64({ maxWeightResource: 1000000 }),
				sourcemaps.init({ loadMaps: true }),
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
		gulpIf("**/*.html", combine(
			img64(),
			templateCache({ module: "facilpad", base: process.cwd() + "/app/" })
		)),
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

gulp.task("all", [ "deps", "app" ], function() {
	return combine(
		es.merge(
			combine(
				gulp.src([ "build/dependencies.js", "build/app.js" ]),
				newer("build/all.js"),
				sourcemaps.init({ loadMaps: true }),
				concat("all.js"),
				sourcemaps.write("./sourcemaps")
			),
			combine(
				gulp.src([ "build/dependencies.css", "build/app.css" ]),
				newer("build/all.css"),
				sourcemaps.init({ loadMaps: true }),
				concat("all.css"),
				sourcemaps.write("./sourcemaps")
			),
			gulp.src("deref.html")
		),
		gulp.dest("build")
	);
});

gulp.task("index", [ "all" ], function() {
	return combine(
		gulp.src("index.html"),
		img64(),
		concat("build/index.html"),
		inject(gulp.src([ "build/all.js", "build/all.css" ], { read: false }), { relative: true, removeTags: true }),
		gulp.dest(".")
	);
});

gulp.task("watch", [ "index" ], function() {
	gulp.watch([ "index.html", "bower.json" ].concat(files), [ "index" ]);
});