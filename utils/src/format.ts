import { marked, type MarkedOptions } from "marked";
import { Units, type Field, type Point, type RouteMode } from "facilmap-types";
import { quoteHtml } from "./utils.js";
import linkifyStr from "linkify-string";
import createPurify from "dompurify";
import { type Cheerio, load } from "cheerio";
import { normalizeFieldValue } from "./objects.js";
import { NodeWithChildren, Element, type Node, type ParentNode, Text, type AnyNode } from "domhandler";
import { getI18n } from "./i18n.js";
import { formatRouteMode } from "./routing.js";
import { getCurrentUnits } from "./i18n-utils.js";

const purify = createPurify(typeof window !== "undefined" ? window : new (await import("jsdom")).JSDOM("").window);

const markdownOptions: MarkedOptions = {
	breaks: true
};

export function formatCheckboxValue(value: string): string {
	return value == "1" ? "✔" : "✘";
}

export function formatField(field: Field, value: string | undefined, html: boolean): string {
	const normalizedValue = normalizeFieldValue(field, value);
	switch(field.type) {
		case "textarea":
			return markdownBlock(normalizedValue, html);
		case "checkbox":
			return formatCheckboxValue(normalizedValue);
		case "dropdown":
			return (html ? quoteHtml(normalizedValue) : normalizedValue) || "";
		case "input":
		default:
			return markdownInline(normalizedValue, html);
	}
}

export function markdownBlock(string: string, html: boolean): string {
	const $ = load("<div/>");
	const el = $.root();
	el.html(purify.sanitize(marked(string, markdownOptions) as string));
	applyMarkdownModifications(el);
	return html ? el.html()! : getTextContent(el);
}

export function markdownInline(string: string, html: boolean): string {
	const $ = load("<div/>");
	const el = $.root();
	el.html(purify.sanitize(marked(string, markdownOptions) as string));
	$("p", el).replaceWith(function() { return $(this).contents(); });
	applyMarkdownModifications(el);
	return html ? el.html()! : getTextContent(el);
}

/**
 * Iterates through the descendant nodes of the given cheerio element, yielding each node when it is opened and when it is
 * closed. For childless nodes (such as text nodes), an open and close object are emitted right after each other.
 */
export function* domTreeIterator(el: Cheerio<ParentNode>): Generator<{ type: "open" | "close"; node: Node }, void, void> {
	const stack: Node[] = [el[0]];
	outer: while (stack.length > 0) {
		const cur = stack[stack.length - 1];
		yield { type: "open", node: cur };
		if (cur instanceof NodeWithChildren && cur.firstChild) {
			stack.push(cur.firstChild);
		} else {
			while (!stack[stack.length - 1].nextSibling || /* Cancel when reaching el */ stack.length === 1) {
				yield { type: "close", node: stack.pop()! };
				if (stack.length === 0) {
					break outer;
				}
			}
			yield { type: "close", node: stack[stack.length - 1] };
			stack[stack.length - 1] = stack[stack.length - 1].nextSibling!;
		}
	}
}

/**
 * Returns the text content of the given cheerio element, making a best attempt to represent line breaks caused by
 * block elements and paragraphs in the given data.
 */
export function getTextContent(el: Cheerio<ParentNode>): string {
    let result = "";
    let currentPrefix = "";
    for (const { type, node } of domTreeIterator(el)) {
        if (node instanceof Element) {
            if (node.tagName === "p") {
                if (type === "open") {
                    result += "\n";
                }
                currentPrefix = "\n";
            } else if (node.tagName === "br" && type === "open") {
                result += "\n";
                currentPrefix = "";
            } else if (!result.endsWith("\n") && ["address", "article", "aside", "blockquote", "details", "dialog", "dd", "dl", "div", "dt", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "li", "main", "nav", "ol", "pre", "section", "table", "ul"].includes(node.tagName)) {
                currentPrefix = "\n";
            } else if (!result.endsWith("\n") && !result.endsWith(" ") && ["td", "th"].includes(node.tagName) && currentPrefix === "") {
                currentPrefix = " ";
            }
        }

        if (type === "open") {
            const text = node instanceof Text ? node.nodeValue.replace(/[\r\n\t ]+/g, " ").trim() : undefined;
            if (text) {
                result += currentPrefix;
                currentPrefix = "";
                result += text;
            }
        }
    }
    return result.trim();
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
	return getI18n().t("format.time", { hours, minutes });
}

export function formatRouteTime(time: number, encodedMode: RouteMode): string {
	return getI18n().t("format.route-time", {
		time: formatTime(time),
		mode: formatRouteMode(encodedMode)
	});
}

export function formatDistance(distance: number): string {
	const units = getCurrentUnits();
	if (units === Units.US_CUSTOMARY) {
		return getI18n().t("format.distance-mi", { distance: round(distance / 1.609344, 2) });
	} else {
		return getI18n().t("format.distance-km", { distance: round(distance, 2) });
	}
}

export function formatElevation(elevation: number): string {
	const units = getCurrentUnits();
	if (units === Units.US_CUSTOMARY) {
		return getI18n().t("format.elevation-ft", { elevation: round(elevation / 0.3048, 0) });
	} else {
		return getI18n().t("format.elevation-m", { elevation });
	}
}

export function formatAscentDescent(ascentDescent: number): string {
	return formatElevation(ascentDescent);
}

function applyMarkdownModifications($el: Cheerio<AnyNode>): void {
	$el.find("a[href]").attr({
		target: "_blank",
		rel: "noopener noreferer"
	});
}

export function renderOsmTag(key: string, value: string): string {
	if(key.match(/^wikipedia(:|$)/)) {
		return value.split(";").map((it) => {
			const m = it.match(/^(\s*)((([-a-z]+):)?(.*))(\s*)$/)!;
			const url = "https://" + (m[4] || "en") + ".wikipedia.org/wiki/" + m[5];
			return m?.[1] + '<a href="' + quoteHtml(url) + '" target="_blank">' + quoteHtml(m[2]) + '</a>' + m[6];
		}).join(";");
	} else if(key.match(/^wikidata(:|$)/)) {
		return value.split(";").map((it) => {
			const m = it.match(/^(\s*)(.*?)(\s*)$/)!;
			return m[1] + '<a href="https://www.wikidata.org/wiki/' + quoteHtml(m[2]) + '" target="_blank">' + quoteHtml(m[2]) + '</a>' + m[3];
		}).join(";");
	} else if(key.match(/^wiki:symbol(:$)/)) {
		return value.split(";").map(function(it) {
			var m = it.match(/^(\s*)(.*?)(\s*)$/)!;
			return m[1] + '<a href="https://wiki.openstreetmap.org/wiki/Image:' + quoteHtml(m[2]) + '" target="_blank">' + quoteHtml(m[2]) + '</a>' + m[3];
		}).join(";");
	} else {
		return linkifyStr(value, {
			target: (href: string, type: string) => type === "url" ? "_blank" : ""
		});
	}
}

export function formatCoordinates(point: Point): string {
	return `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`;
}
