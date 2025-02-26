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

export function formatFieldValue(field: Field, value: string | undefined, html: boolean): string {
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

export function formatTypeName(name: string): string {
	// By default we create a type "Marker" and a type "Line" for each new map. Since these type names are hard-coded,
	// we need to translate them based on their hard-coded name.
	if (name === "Marker") {
		return getI18n().t("format.marker-type-name");
	} else if (name === "Line") {
		return getI18n().t("format.line-type-name");
	} else {
		return name;
	}
}

export function formatFieldName(name: string): string {
	// By default we create a "Description" field for each type. Since the field name is hard-coded,  we need to translate
	// it based on its hard-coded name.
	if (name === "Description") {
		return getI18n().t("format.description-field-name");
	} else {
		return name;
	}
}

export function formatPOIName(name: string): string {
	return name || getI18n().t("format.unnamed-poi");
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

export function padNumber(number: number, digits: number): string {
	const spl = String(number).split(/(?=\.)/);
	spl[0] = spl[0].padStart(digits, "0");
	return spl.join("");
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

export function kmToMi(km: number): number {
	return km / 1.609344;
}

export function mToFt(m: number): number {
	return m / 0.3048;
}

export function formatDistance(distance: number, decimals = 2): string {
	const units = getCurrentUnits();
	if (units === Units.US_CUSTOMARY) {
		return getI18n().t("format.distance-mi", { distance: round(kmToMi(distance), decimals) });
	} else {
		return getI18n().t("format.distance-km", { distance: round(distance, decimals) });
	}
}

export function formatElevation(elevation: number): string {
	const units = getCurrentUnits();
	if (units === Units.US_CUSTOMARY) {
		return getI18n().t("format.elevation-ft", { elevation: round(mToFt(elevation), 0) });
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

export type Degrees = {
	sign: "-" | "";
	degFloat: number;
	degInt: number;
	minFloat: number;
	minInt: number;
	secFloat: number;
};

function getDegrees(coord: number): Degrees {
	const sign =  coord < 0 ? "-" : "";
	const degFloat = Math.abs(coord);
	const degInt = Math.floor(degFloat);
	const minFloat = (degFloat - degInt) * 60;
	const minInt = Math.floor(minFloat);
	const secFloat = (minFloat - minInt) * 60;
	return { sign, degFloat, degInt, minInt, minFloat, secFloat };
}

export function getCoordinateDegrees(point: Point): { lat: Degrees & { letter: "N" | "S" }; lon: Degrees & { letter: "E" | "W" } } {
	const lat = getDegrees(point.lat);
	const lon = getDegrees(point.lon);
	return {
		lat: {
			...lat,
			letter: lat.sign === "-" ? "S" : "N"
		},
		lon: {
			...lon,
			letter: lon.sign === "-" ? "W" : "E"
		}
	};
}

export function formatCoordinateDegrees(point: Point): string {
	const deg = getCoordinateDegrees(point);
	return (
		`${deg.lat.degInt}°\u202f${padNumber(deg.lat.minInt, 2)}\u2032\u202f${padNumber(round(deg.lat.secFloat, 1), 2)}\u2033\u202f${deg.lat.letter}`
		+ ", "
		+ `${deg.lon.degInt}°\u202f${padNumber(deg.lon.minInt, 2)}\u2032\u202f${padNumber(round(deg.lon.secFloat, 1), 2)}\u2033\u202f${deg.lon.letter}`
	);
}