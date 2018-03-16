const marked = require('marked');

const isBrowser = (typeof window !== "undefined");
const jQuery = isBrowser ? require("jquery") : null;
const cheerio = isBrowser ? null : require("cheerio");

marked.setOptions({
	breaks: true,
	sanitize: true
});

const format = module.exports = {
	formatField(field, value) {
		if(value == null)
			value = field['default'] || "";
		switch(field.type) {
			case "textarea":
				return format.markdownBlock(value);
			case "checkbox":
				return value == "1" ? "✔" : "✘";
			case "dropdown":
				return value || "";
			case "input":
			default:
				return format.markdownInline(value);
		}
	},

	markdownBlock(string, options) {
		let $ = isBrowser ? jQuery : cheerio.load("<div/>");
		let ret = isBrowser ? $("<div/>") : $.root();

		ret.html(marked(string, options));
		$("a[href]", ret).attr("target", "_blank");
		return ret.html();
	},

	markdownInline(string, options) {
		let $ = isBrowser ? jQuery : cheerio.load("<div/>");
		let ret = isBrowser ? $("<div/>") : $.root();

		ret.html(marked(string, options));
		$("p", ret).replaceWith(function() { return $(this).contents(); });
		$("a[href]", ret).attr("target", "_blank");
		return ret.html();
	},

	round(number, digits) {
		var fac = Math.pow(10, digits);
		return Math.round(number*fac)/fac;
	},

	formatTime(seconds) {
		var hours = Math.floor(seconds/3600);
		var minutes = Math.floor((seconds%3600)/60);
		if(minutes < 10)
			minutes = "0" + minutes;
		return hours + ":" + minutes;
	}
};