import marked, { MarkedOptions } from 'marked';
import { Field } from "facilmap-types";
import { createDiv, $ } from './dom';
import { normalizeField } from './filter';


marked.setOptions({
	breaks: true,
	sanitize: true
});

export function formatField(field: Field, value: string): string {
	value = normalizeField(field, value, false);
	switch(field.type) {
		case "textarea":
			return markdownBlock(value);
		case "checkbox":
			return value == "1" ? "✔" : "✘";
		case "dropdown":
			return value || "";
		case "input":
		default:
			return markdownInline(value);
	}
}

export function markdownBlock(string: string, options?: MarkedOptions): string {
	const ret = createDiv();
	ret.html(marked(string, options));
	applyMarkdownModifications(ret);
	return ret.html()!;
}

export function markdownInline(string: string, options?: MarkedOptions): string {
	const ret = createDiv();
	ret.html(marked(string, options));
	$("p", ret).replaceWith(function(this: cheerio.Element) { return $(this).contents(); });
	applyMarkdownModifications(ret);
	return ret.html()!;
}

export function round(number: number, digits: number): number {
	const fac = Math.pow(10, digits);
	return Math.round(number*fac)/fac;
}

export function formatTime(seconds: number): string {
	const hours = Math.floor(seconds/3600);
	let minutes: string | number = Math.floor((seconds%3600)/60);
	if(minutes < 10)
		minutes = "0" + minutes;
	return hours + ":" + minutes;
}

function applyMarkdownModifications($el: cheerio.Cheerio): void {
	$("a[href]", $el).attr({
		target: "_blank",
		rel: "noopener noreferer"
	});


	$("a[href^='mailto:']", $el).each(function(this: cheerio.Element) {
		const $a = $(this);
		let m = $a.attr("href")!.match(/^mailto:(.*)@(.*)$/i);
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
