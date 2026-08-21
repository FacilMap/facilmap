import { Marked, type MarkedOptions } from "marked";
import { Units, type Field, type Line, type MapData, type Marker, type Point, type RouteMode, type Type } from "facilmap-types";
import { quoteHtml, quoteRegExp } from "./utils.js";
import linkifyStr from "linkify-string";
import createPurify from "dompurify";
import { type Cheerio, load } from "cheerio";
import { normalizeFieldValue } from "./objects.js";
import { NodeWithChildren, Element, type Node, type ParentNode, Text, type AnyNode } from "domhandler";
import { getI18n } from "./i18n.js";
import { formatRouteMode } from "./routing.js";
import { getCurrentUnits } from "./i18n-utils.js";
import { compileFormulaExpression } from "./filter.js";

const purify = createPurify(typeof window !== "undefined" ? window : new (await import("jsdom")).JSDOM("").window);

export const markdownOptions = {
	breaks: true
} satisfies MarkedOptions;

export const tableClasses = "table table-hover table-bordered";
export const taskListClasses = "task-list";

const marked = new Marked(markdownOptions);

export const CHECKBOX_TRUE_LABEL = "✔";
export const CHECKBOX_FALSE_LABEL = "✘";

export function formatCheckboxValue(value: string): string {
	return value == "1" ? CHECKBOX_TRUE_LABEL : CHECKBOX_FALSE_LABEL;
}

export function formatFieldValue(mapData: MapData, type: Type, field: Field, object: Marker | Line, html: boolean): string {
	if (field.type === "formula") {
		const result = compileFormulaExpression(field.formula, mapData.customFunctions)(object, type);
		return markdownInline(result, html);
	}

	const normalizedValue = normalizeFieldValue(field, object.data[field.name]);
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
	el.html(purify.sanitize(marked.parse(string) as string));
	applyMarkdownModifications(el);
	return html ? el.html()! : getTextContent(el);
}

export function markdownInline(string: string, html: boolean): string {
	const $ = load("<div/>");
	const el = $.root();
	el.html(purify.sanitize(marked.parseInline(string) as string));
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

function cheerioEach(elements: Cheerio<AnyNode>, callback: (el: Cheerio<AnyNode>) => void): void {
	for (let i = 0; i < elements.length; i++) {
		callback(elements.eq(i));
	}
}

function applyMarkdownModifications($el: Cheerio<AnyNode>): void {
	$el.find("a[href]").attr({
		target: "_blank",
		rel: "noopener noreferer"
	});

	cheerioEach($el.find("table"), (el) => {
		el.addClass(tableClasses);
	});

	cheerioEach($el.find("ul"), (ul) => {
		if (ul.find("> li > input[type=checkbox]").length > 0) {
			ul.addClass(taskListClasses);

			// Wrap items in <label> to make text clickable
			cheerioEach(ul.find("> li"), (li) => {
				const html = li.html() ?? "";
				li.html("<label></label>");
				li.children().html(html);
			});
		}
	});
}

export function renderOsmTag(key: string, value: string): string {
	const isTag = (tag: string) => !!key.match(new RegExp(`(^${quoteRegExp(tag)}(:|$))|((^|:)${quoteRegExp(tag)}$)`));
	const replace = (getReplacementHtml: (value: string) => string) => value.split(";").map((it) => {
		const m = it.match(/^(\s*)(.*?)(\s*)$/)!;
		return `${m[1]}${getReplacementHtml(m[2])}${m[3]}`;
	}).join(";");
	const replaceLink = (getUrl: (value: string) => string | undefined) => replace((value) => {
		const url = getUrl(value);
		return url ? `<a href="${quoteHtml(url)}" target="_blank">${quoteHtml(value)}</a>` : quoteHtml(value);
	});

	if (isTag("wikipedia")) {
		return replaceLink((value) => {
			const m = value.match(/^(([-a-z]+):)?(.*)$/)!;
			return `https://${m[2] || "en"}.wikipedia.org/wiki/${encodeURIComponent(m[3])}`;
		});
	} else if (isTag("wikidata")) {
		return replaceLink((v) => `https://www.wikidata.org/wiki/${encodeURIComponent(v)}`);
	} else if (isTag("wikimedia_commons")) {
		return replaceLink((v) => `https://commons.wikimedia.org/wiki/${encodeURIComponent(v)}`);
	} else if (isTag("flag") || isTag("coat_of_arms")) {
		return replaceLink((v) => v.startsWith("File:") ? `https://commons.wikimedia.org/wiki/${encodeURIComponent(v)}` : undefined);
	} else if (isTag("wiki:symbol")) {
		return replaceLink((v) => `https://wiki.openstreetmap.org/wiki/Image:${encodeURIComponent(v)}`);
	} else if (isTag("mapillary")) {
		return replaceLink((v) => `https://www.mapillary.com/app/?pKey=${encodeURIComponent(v)}`);
	} else if (isTag("panoramax")) {
		return replaceLink((v) => `https://api.panoramax.xyz/#focus=pic&pic=${encodeURIComponent(v)}`);
	} else if (isTag("kartaview")) {
		return replaceLink((v) => `https://kartaview.org/details/${v}`); // May contain a slash, hence no encode
	} else {
		return linkifyStr(value, {
			target: (href, type) => type === "url" ? "_blank" : "",
			validate: (value) => !value.match(/^file:/i)
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