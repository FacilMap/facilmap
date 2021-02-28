import { $ } from "./dom";

export function obfuscate($el: cheerio.Cheerio): void {
	$el.find("a[href^='mailto:']").each(function(this: cheerio.Element) {
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

export function deobfuscate($a: cheerio.Cheerio): void {
	if($a.hasClass("emobf")) {
		$a.attr({
			href: `mailto:${$a.attr("data-u")}@${$a.attr("data-d")}`,
			target: ""
		});
	}

	if($a.hasClass("emobf2")) {
		$a.text(`${$a.attr("data-u")}@${$a.attr("data-d")}`);
	}

	$a.removeClass("emobf emobf2");
}
