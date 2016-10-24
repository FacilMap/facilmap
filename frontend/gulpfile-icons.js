var cheerio = require("cheerio");
var through = require('through2');
var fs = require('fs');
var gutil = require('gulp-util');
var path = require("path");
var svgo = require("svgo");
var Promise = require("promise");

function cleanIcon(icon) {
	return new Promise(function(resolve, reject) {
		new svgo().optimize(icon, function(result) {
			if(result.error)
				reject(result.error);
			else
				resolve(result.data);
		});
	}).then(function(icon) {
		var $ = cheerio.load(icon, {
			xmlMode: true
		});

		$("*").each(function() {
			this.name = this.name.replace(/^svg:/, "");
		});

		$("metadata,sodipodi\\:namedview,defs,image").remove();

		$("*").each(function() {
			var $this = $(this);

			var fill = $this.css("fill") || $this.attr("fill");
			if(fill && fill != "none") {
				if(fill != "#ffffff" && fill != "#fff") // This is the background
					return $this.remove();

				if($this.css("fill"))
					$this.css("fill", "#000");
				else
					$this.attr("fill", "#000");
			}

			if($this.css("stroke") && $this.css("stroke") != "none")
				$this.css("stroke", "#000");
			else if($this.attr("stroke") && $this.attr("stroke") != "none")
				$this.attr("stroke", "#000");
		});

		return $(":root").html().replace(/(>|^)\s+(<|$)/g, "$1$2");
	});
}

module.exports = function(file, code) {
	if (!file) {
		throw new gutil.PluginError('gulp-facilmap-icons', 'Missing file option for gulp-facilmap-icons');
	}

	var content = { };
	var last;

	return through.obj(function(file, enc, cb) {
		if (file.isStream()) {
			this.emit('error', new gutil.PluginError('gulp-facilmap-icons',  'Streaming not supported'));
			return cb();
		}

		cleanIcon(file.contents).then(function(icon) {
			content[file.relative.replace(/\//g, "_").replace(/\.svg$/, "")] = icon;
			last = file;
			cb();
		}).catch(cb);
	}, function endStream(cb) {
		if(last) {
			var ret = last.clone({contents: false});
	        ret.path = path.join(last.base, file);
			ret.contents = new Buffer(code.replace(/%s/, JSON.stringify(content)));
			this.push(ret);
		}

		cb();
	});
};
