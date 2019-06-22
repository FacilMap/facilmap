const marked = require('marked');

const isBrowser = (typeof window !== "undefined");
const jQuery = isBrowser ? require("jquery") : null;
const cheerio = isBrowser ? null : require("cheerio");

marked.setOptions({
	breaks: true,
	sanitize: true
});

const format = module.exports = {
	normalizeField(field, value, enforceExistingOption) {
		if(value == null)
			value = field['default'] || "";

		if(field.type == "checkbox")
			value = value == "1" ? "1" : "0";

		if(enforceExistingOption && field.type == "dropdown" && !field.options.some((option) => option.value == value) && field.options[0])
			value = field.options[0].value;

		return value;
	},

	formatField(field, value) {
		value = format.normalizeField(field, value, false);
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
		format._applyMarkdownModifications(ret, $);
		return ret.html();
	},

	markdownInline(string, options) {
		let $ = isBrowser ? jQuery : cheerio.load("<div/>");
		let ret = isBrowser ? $("<div/>") : $.root();

		ret.html(marked(string, options));
		$("p", ret).replaceWith(function() { return $(this).contents(); });
		format._applyMarkdownModifications(ret, $);
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
	},

	_applyMarkdownModifications($el, $) {
		$("a[href]", $el).attr({
			target: "_blank",
			rel: "noopener noreferer"
		});

		$("a[href^='mailto:']", $el).each(function() {
			const $a = $(this);
			let m = $a.attr("href").match(/^mailto:(.*)@(.*)$/i);
			if(m) {
				$a.attr({
					href: "#",
					"data-u": m[1],
					"data-d": m[2]
				}).addClass("emobf");
			}

			m = $a.text().match(/^(.*)@(.*)$/);
			if(m && $a.children().length == 0) {
				$a.attr({
					"data-u2": m[1],
					"data-d2": m[2]
				}).addClass("emobf2").html("<span>[obfuscated]</span>");
			}
		});
	}

};