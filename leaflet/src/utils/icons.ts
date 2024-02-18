import type { Shape, Symbol } from "facilmap-types";
import { makeTextColour, quoteHtml } from "facilmap-utils";
import { Icon, type IconOptions } from "leaflet";
import { memoize } from "lodash-es";
import iconKeys, { coreIconKeys } from "virtual:icons:keys";
import rawIconsCore from "virtual:icons:core";

export { coreIconKeys as coreSymbolList };

export const symbolList: string[] = Object.values(iconKeys).flat();

export const RAINBOW_STOPS = `<stop offset="0" stop-color="red"/><stop offset="33%" stop-color="#ff0"/><stop offset="50%" stop-color="#0f0"/><stop offset="67%" stop-color="cyan"/><stop offset="100%" stop-color="blue"/>`;

interface ShapeInfo {
	/** An SVG path that defines the shape of the marker and has a height of 36px. */
	path: string;

	/** The width of the SVG path. */
	width: number;

	/** The X and Y coordinates of the point on the marker that should be aligned with the point on the map.
	 * For a square marker, the bottom center would be [36, 18] and the center would be [18, 18]. */
	base: [number, number];

	/** The X and Y coordinates of the center of the marker. This is where the symbol will be inserted.
	 * For a square marker, the center would be [18, 18]. */
	center: [number, number];

	/** The height/width that inserted symbols should have. */
	symbolSize: number;

	/** Scale factor for the shape itself. If this is 1, a markers that has its size set to 25 will be 25px high. */
	scale: number;
}

const SHAPE_HEIGHT = 36;
const DEFAULT_SHAPE: Shape = "drop";

const MARKER_SHAPES: Record<Shape, ShapeInfo> = {
	"drop": {
		path: "M13 0C4.727 0 0 4.8 0 13.2 0 21.6 11.744 36 13 36c1.256 0 13-14.4 13-22.8S21.273 0 13 0z",
		width: 26,
		base: [13, 36],
		center: [13, 13],
		symbolSize: 18,
		scale: 1
	},
	"rectangle-marker": {
		path: "M2.64 0A2.646 2.646 0 0 0 0 2.646v24.708A2.646 2.646 0 0 0 2.646 30h8.89l1.732 3L15 36l1.732-3 1.732-3h8.89A2.646 2.646 0 0 0 30 27.354V2.646A2.646 2.646 0 0 0 27.354 0H2.646a2.646 2.646 0 0 0-.005 0z",
		width: 30,
		base: [15, 36],
		center: [15, 15],
		symbolSize: 24,
		scale: 0.95
	},
	"circle": {
		path: "M36 18a18 18 0 0 1-18 18A18 18 0 0 1 0 18 18 18 0 0 1 18 0a18 18 0 0 1 18 18z",
		width: 36,
		base: [18, 18],
		center: [18, 18],
		symbolSize: 24,
		scale: 0.85
	},
	"rectangle": {
		path: "M2.646 0h30.708A2.646 2.646 45 0 1 36 2.646v30.708A2.646 2.646 135 0 1 33.354 36H2.646A2.646 2.646 45 0 1 0 33.354V2.646A2.646 2.646 135 0 1 2.646 0z",
		width: 36,
		base: [18, 18],
		center: [18, 18],
		symbolSize: 28,
		scale: 0.8
	},
	"diamond": {
		path: "M19.382.573l16.045 16.045a1.955 1.955 90 0 1 0 2.764L19.382 35.427a1.955 1.955 180 0 1-2.764 0L.573 19.382a1.955 1.955 90 0 1 0-2.764L16.618.573a1.955 1.955 0 0 1 2.764 0z",
		width: 36,
		base: [18, 18],
		center: [18, 18],
		symbolSize: 18,
		scale: 0.9
	},
	"pentagon": {
		path: "M20.078.347l17.17 12.371a1.808 1.808 71.97 0 1 .662 2.03l-6.562 19.995A1.826 1.826 144.093 0 1 29.612 36l-21.237-.006a1.826 1.826 35.94 0 1-1.735-1.258L.09 14.738a1.808 1.808 108.063 0 1 .662-2.03L17.93.346a1.837 1.837.017 0 1 2.148 0z",
		width: 38,
		base: [19, 20],
		center: [19, 20],
		symbolSize: 20,
		scale: 0.85
	},
	"hexagon": {
		path: "M14.833 35.692L1.151 27.826A2.305 2.29 0 0 1 0 25.842l.013-15.71A2.305 2.29 0 0 1 1.167 8.15L14.862.306a2.305 2.29 0 0 1 2.305.002l13.682 7.866A2.305 2.29 0 0 1 32 10.158l-.013 15.71a2.305 2.29 0 0 1-1.154 1.982l-13.695 7.844a2.305 2.29 0 0 1-2.305-.002z",
		width: 32,
		base: [16, 18],
		center: [16, 18],
		symbolSize: 22,
		scale: 0.9
	},
	"triangle": {
		path: "M.134 34.33L19.976.494a1.013 1.013 179.88 0 1 1.746-.003l20.139 34.014a.986.986 119.818 0 1-.853 1.489L.977 35.809a.982.982 60.327 0 1-.843-1.48z",
		width: 42,
		base: [21, 24],
		center: [21, 24],
		symbolSize: 16,
		scale: 0.85
	},
	"triangle-down": {
		path: "M.934 0a.96.96 0 0 0-.805 1.44l19.036 33.12.004.007.824 1.433.828-1.44 19.05-33.112a.96.96 0 0 0-.828-1.44L.958.001H.934z",
		width: 40,
		base: [20, 36],
		center: [20, 12],
		symbolSize: 16,
		scale: 0.85
	},
	"star": {
		path: "M19.007 0l5.865 11.851L38 13.758l-9.505 9.218L30.732 36l-11.74-6.154-11.746 6.142 2.25-13.021L0 13.739l13.13-1.893z",
		width: 38,
		base: [19, 18],
		center: [19, 20],
		symbolSize: 14,
		scale: 0.9
	}
};

export const shapeList = Object.keys(MARKER_SHAPES) as Shape[];

const sizes: Record<string, number> = {
	osmi: 580,
	mdiconic: 1000,
	glyphicons: 1410,
	fontawesome: 640
};

export const getLetterOffset = memoize((letter: string): { x: number, y: number } => {
	const ctx = document.createElement("canvas").getContext("2d")!;
	ctx.font = "25px sans-serif";
	const dim = ctx.measureText(letter);

	const letterWidth = dim.width; // dim.actualBoundingBoxRight + dim.actualBoundingBoxLeft;
	const letterHeight = dim.actualBoundingBoxAscent + dim.actualBoundingBoxDescent;

	return {
		x: (25 - letterWidth) / 2,
		y: (25 - letterHeight) / 2 + dim.actualBoundingBoxAscent
	};
});

/**
 * Downloads the icons chunk to have them already downloaded the first time the icon code is needed.
 */
export async function preloadExtraSymbols(): Promise<void> {
	await import("virtual:icons:extra");
}

async function getRawSymbolCode(symbol: Symbol): Promise<[set: string, code: string]> {
	if (coreIconKeys.includes(symbol)) {
		const set = Object.keys(rawIconsCore).filter((i) => (rawIconsCore[i][symbol] != null))[0];
		return [set, rawIconsCore[set][symbol]];
	} else if (symbolList.includes(symbol)) {
		const { default: rawIconsExtra } = await import("virtual:icons:extra");
		const set = Object.keys(rawIconsExtra).filter((i) => (rawIconsExtra[i][symbol] != null))[0];
		return [set, rawIconsExtra[set][symbol]];
	} else {
		throw new Error(`Unknown icon ${symbol}.`);
	}
}

export async function getSymbolCode(colour: string, size: number, symbol?: Symbol): Promise<string> {
	if(symbol && symbolList.includes(symbol)) {
		const [set, code] = await getRawSymbolCode(symbol);

		if(set == "osmi") {
			return `<g transform="scale(${size / sizes.osmi})">${code.replace(/#000/g, colour)}</g>`;
		}

		const widthMatch = code.match(/^<svg [^>]* width="([0-9.]+)"/);
		const heightMatch = code.match(/^<svg [^>]* height="([0-9.]+)"/);
		const viewBoxMatch = code.match(/^<svg [^>]* viewBox="([ 0-9.]+)"/);

		const width = Number(widthMatch ? widthMatch[1] : viewBoxMatch![1].split(" ")[2]);
		const height = Number(heightMatch ? heightMatch[1] : viewBoxMatch![1].split(" ")[3]);
		const scale = size / sizes[set];
		const moveX = (sizes[set] - width) / 2;
		const moveY = (sizes[set] - height) / 2;
		const content = code.replace(/^<svg [^>]*>/, "").replace(/<\/svg>$/, "");

		return `<g transform="scale(${scale}) translate(${moveX}, ${moveY})" fill="${colour}">${content}</g>`;
	} else if (symbol && symbol.length == 1) {
		try {
			const offset = getLetterOffset(symbol);
			return (
				`<g transform="scale(${size / 25}) translate(${offset.x}, ${offset.y})">` +
					`<text style="font-size: 25px; font-family: sans-serif; fill: ${colour}">${quoteHtml(symbol)}</text>` +
				`</g>`
			);
		} catch (e) {
			console.error("Error creating letter symbol.", e);
		}
	}

	return `<circle style="fill:${colour}" cx="${Math.floor(size / 2)}" cy="${Math.floor(size / 2)}" r="${Math.floor(size / 6)}" />`;
}

export async function getSymbolUrl(colour: string, height: number, symbol?: Symbol): Promise<string> {
	const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>` +
	`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${height}" height="${height}" viewbox="0 0 24 24" version="1.1">` +
		(await getSymbolCode(colour, 24, symbol)) +
	`</svg>`;

	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export async function getSymbolHtml(colour: string, height: number | string, symbol?: Symbol): Promise<string> {
	return `<svg width="${height}" height="${height}" viewbox="0 0 24 24">` +
		(await getSymbolCode(colour, 24, symbol)) +
	`</svg>`;
}

let idCounter = 0;

export async function getMarkerCode(colour: string, height: number, symbol?: Symbol, shape?: Shape, highlight = false): Promise<string> {
	const borderColour = makeTextColour(colour, 0.3);
	const id = `${idCounter++}`;
	const colourCode = colour == "rainbow" ? `url(#fm-rainbow-${id})` : colour;
	const shapeObj = (shape && MARKER_SHAPES[shape]) || MARKER_SHAPES[DEFAULT_SHAPE];
	const symbolCode = await getSymbolCode(borderColour, shapeObj.symbolSize, symbol);
	const translateX = `${Math.floor(shapeObj.center[0] - shapeObj.symbolSize / 2)}`;
	const translateY = `${Math.floor(shapeObj.center[1] - shapeObj.symbolSize / 2)}`;

	return (
		`<g transform="scale(${height / SHAPE_HEIGHT})">` +
			(colour == "rainbow" ? `<defs><linearGradient id="fm-rainbow-${id}" x2="0" y2="100%">${RAINBOW_STOPS}</linearGradient></defs>` : '') +
			`<path id="shape-${id}" style="stroke: ${borderColour}; stroke-width: ${highlight ? 6 : 2}; stroke-linecap: round; fill: ${colourCode}; clip-path: url(#clip-${id})" d="${quoteHtml(shapeObj.path)}"/>"/>` +
			`<clipPath id="clip-${id}"><use xlink:href="#shape-${id}"/></clipPath>` + // Don't increase the size by increasing the border: https://stackoverflow.com/a/32162431/242365
			`<g transform="translate(${translateX}, ${translateY})">${symbolCode}</g>` +
		`</g>`
	);
}

export async function getMarkerUrl(colour: string, height: number, symbol?: Symbol, shape?: Shape, highlight = false): Promise<string> {
	const shapeObj = (shape && MARKER_SHAPES[shape]) || MARKER_SHAPES[DEFAULT_SHAPE];
	const width = Math.ceil(height * shapeObj.width / SHAPE_HEIGHT);
	return "data:image/svg+xml,"+encodeURIComponent(
		`<?xml version="1.0" encoding="UTF-8" standalone="no"?>` +
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${shapeObj.width} ${SHAPE_HEIGHT}" version="1.1">` +
			(await getMarkerCode(colour, SHAPE_HEIGHT, symbol, shape, highlight)) +
		`</svg>`
	);
}

export async function getMarkerHtml(colour: string, height: number, symbol?: Symbol, shape?: Shape, highlight = false): Promise<string> {
	const shapeObj = (shape && MARKER_SHAPES[shape]) || MARKER_SHAPES[DEFAULT_SHAPE];
	const width = Math.ceil(height * shapeObj.width / SHAPE_HEIGHT);
	return (
		`<svg width="${width}" height="${height}" viewBox="0 0 ${shapeObj.width} ${SHAPE_HEIGHT}">` +
			(await getMarkerCode(colour, SHAPE_HEIGHT, symbol, shape, highlight)) +
		`</svg>`
	);
}

export const TRANSPARENT_IMAGE_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";

/**
 * A Leaflet icon that accepts a promise for its URL and will update the image src when the promise is resolved.
 */
export class AsyncIcon extends Icon {
	private _asyncIconUrl: Promise<string>;

	constructor(options: Omit<IconOptions, "iconUrl"> & { iconUrl: string | Promise<string> }) {
		super({ ...options, iconUrl: TRANSPARENT_IMAGE_URL });
		this._asyncIconUrl = Promise.resolve(options.iconUrl);
		this._asyncIconUrl.catch((err) => {
			console.error("Error loading async icon", err);
		});
	}

	override createIcon(oldIcon?: HTMLElement): HTMLElement {
		const icon = super.createIcon(oldIcon);
		const prevSrc = icon.getAttribute("src");
		this._asyncIconUrl.then((url) => {
			if (icon.getAttribute("src") === prevSrc) {
				icon.setAttribute("src", url);
			}
		});
		return icon;
	}
}

export function getMarkerIcon(colour: string, height: number, symbol?: Symbol, shape?: Shape, highlight = false): Icon {
	const shapeObj = (shape && MARKER_SHAPES[shape]) || MARKER_SHAPES[DEFAULT_SHAPE];
	const scale = shapeObj.scale * height / SHAPE_HEIGHT;
	const result = new AsyncIcon({
		iconUrl: getMarkerUrl(colour, height, symbol, shape, highlight),
		iconSize: [Math.round(shapeObj.width*scale), Math.round(SHAPE_HEIGHT*scale)],
		iconAnchor: [Math.round(shapeObj.base[0]*scale), Math.round(shapeObj.base[1]*scale)],
		popupAnchor: [0, -height]
	});

	return result;
}


const RELEVANT_TAGS = [
	"aerialway", "aeroway", "amenity", "barrier", "boundary", "building", "entrance", "craft", "emergency", "geological", "healthcare",
	"highway", "cycleway", "busway", "abutters", "bus_bay", "junction", "sac_scale", "service", "surface", "tracktype", "traffic_calming",
	"historic", "landuse", "leisure", "man_made", "military", "natural", "office", "place", "power", "public_transport", "railway",
	"usage", "route", "shop", "sport", "telecom", "tourism", "water", "waterway", "bridge", "crossing", "access", "religion", "denomination",
	"plant:source"
];

export function getSymbolForTags(tags: Record<string, string>): Symbol {
	const tagWords = Object.entries(tags).flatMap(([k, v]) => (RELEVANT_TAGS.includes(k) ? v.split(/_:/) : []));
	let result: Symbol = "";
	let resultMatch: number = 0;
	for (const icon of iconKeys.osmi) {
		const iconWords = icon.split("_");
		const match = tagWords.filter((word) => iconWords.includes(word)).length;
		if (match > resultMatch) {
			resultMatch = match;
			result = icon;
		}
	}

	return result;
}