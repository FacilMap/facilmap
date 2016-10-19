var cheerio = require("cheerio");
var through = require('through2');
var mime = require('mime');
var path = require('path');
var fs = require('fs');
var gutil = require('gulp-util');

function replacePath(ssrc, file) {
	var isdata = ssrc.indexOf("data");
	if (ssrc != "" && typeof ssrc != 'undefined' && isdata !== 0) {
		var spath = path.isAbsolute(ssrc) ? path.join(file.base, ssrc) : path.resolve(path.dirname(file.path), ssrc);
		var mtype = mime.lookup(spath);
		if (mtype != 'application/octet-stream') {
			var sfile = fs.readFileSync(spath);
			var simg64 = new Buffer(sfile).toString('base64');
			return 'data:' + mtype + ';base64,' + simg64;
		}
	}
}

module.exports = function() {
	return through.obj(function(file, enc, callback) {
		if (file.isNull()) {
			this.push(file);
			// do nothing if no contents
			return callback();
		}

		if (file.isStream()) {
			this.emit('error', new gutil.PluginError('gulp-img64', 'Streaming not supported'));
			return callback();
		}

		if (file.isBuffer()) {
			var $ = cheerio.load(String(file.contents), {
				xmlMode: mime.lookup(file.path) == "application/xml"
			});

			$('img').each(function() {
				$(this).attr('src', replacePath($(this).attr('src'), file));
			});

			$('link[rel~=icon]').each(function() {
				$(this).attr('href', replacePath($(this).attr('href'), file));
			});

			$('OpenSearchDescription Image').each(function() {
				$(this).text(replacePath($(this).text(), file));
			});

			file.contents = new Buffer($.html());

			return callback(null, file);
		}
	});
};