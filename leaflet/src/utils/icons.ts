import { Colour, Shape, Symbol } from "facilmap-types";
import { makeTextColour, quoteHtml } from "facilmap-utils";
import L, { Icon } from "leaflet";
import { memoize } from "lodash";

const rawIconsContext = require.context("../../assets/icons");
const rawIcons: Record<string, Record<string, string>> = {};
for (const key of rawIconsContext.keys() as string[]) {
    const [set, fname] = key.split("/").slice(-2);
    
    if (!rawIcons[set])
        rawIcons[set] = {};
    
    rawIcons[set][fname.replace(/\.svg$/, "")] = rawIconsContext(key);
}

rawIcons["fontawesome"] = {};
for (const name of ["arrow-left", "arrow-right", "biking", "car-alt", "chart-line", "info-circle", "slash", "walking"]) {
    rawIcons["fontawesome"][name] = require(`@fortawesome/fontawesome-free/svgs/solid/${name}.svg`);
}

export const symbolList = Object.keys(rawIcons).map((key) => Object.keys(rawIcons[key])).flat();

export const RAINBOW_STOPS = `<stop offset="0" stop-color="red"/><stop offset="33%" stop-color="#ff0"/><stop offset="50%" stop-color="#0f0"/><stop offset="67%" stop-color="cyan"/><stop offset="100%" stop-color="blue"/>`;

interface ShapeInfo {
    svg: string;
    highlightSvg: string;
    height: number;
    width: number;
    baseX: number;
    baseY: number;
}

const MARKER_SHAPES: Partial<Record<Shape, ShapeInfo>> = {
    drop: {
        svg: (
            `<path id="drop-%ID%" style="stroke: %BORDER_COLOUR%; stroke-width: 2; stroke-linecap: round; fill: %COLOUR%; clip-path: url(#clip-%ID%)" d="M13 0C4.727 0 0 4.8 0 13.2 0 21.6 11.744 36 13 36c1.256 0 13-14.4 13-22.8S21.273 0 13 0z"/>"/>` +
            `<clipPath id="clip-%ID%"><use xlink:href="#drop-%ID%"/></clipPath>` + // Don't increase the size by increasing the border: https://stackoverflow.com/a/32162431/242365
            `<g transform="translate(4, 4) scale(0.75)">%SYMBOL%</g>`
        ),
        highlightSvg: (
            `<path id="drop-%ID%" style="stroke: %BORDER_COLOUR%; stroke-width: 6; stroke-linecap: round; fill: %COLOUR%; clip-path: url(#clip-%ID%)" d="M13 0C4.727 0 0 4.8 0 13.2 0 21.6 11.744 36 13 36c1.256 0 13-14.4 13-22.8S21.273 0 13 0z"/>"/>` +
            `<clipPath id="clip-%ID%"><use xlink:href="#drop-%ID%"/></clipPath>` +
            `<g transform="translate(4, 4) scale(0.75)">%SYMBOL%</g>`
        ),
        height: 36,
        width: 26,
        baseX: 13,
        baseY: 36
    },
    circle: {
        svg: (
            `<circle id="circle-%ID%" style="stroke: %BORDER_COLOUR%; stroke-width: 2; fill: %COLOUR%; clip-path: url(#clip-%ID%)" cx="18" cy="18" r="18" />` +
            `<clipPath id="clip-%ID%"><use xlink:href="#circle-%ID%"/></clipPath>` +
            `<g transform="translate(6, 6)">%SYMBOL%</g>`
        ),
        highlightSvg: (
            `<circle id="circle-%ID%" style="stroke: %BORDER_COLOUR%; stroke-width: 6; fill: %COLOUR%; clip-path: url(#clip-%ID%)" cx="18" cy="18" r="18" />` +
            `<clipPath id="clip-%ID%"><use xlink:href="#circle-%ID%"/></clipPath>` +
            `<g transform="translate(6, 6)">%SYMBOL%</g>`
        ),
        height: 36,
        width: 36,
        baseX: 18,
        baseY: 18
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

export function getSymbolCode(colour: Colour, size: number, symbol?: Symbol): string {
    if(symbol && symbolList.includes(symbol)) {
        const set = Object.keys(rawIcons).filter((i) => (rawIcons[i][symbol] != null))[0];

        if(set == "osmi") {
            return `<g transform="scale(${size / sizes.osmi})">${rawIcons[set][symbol].replace(/#000/g, colour)}</g>`;
        }

        const widthMatch = rawIcons[set][symbol].match(/^<svg [^>]* width="([0-9.]+)"/);
        const heightMatch = rawIcons[set][symbol].match(/^<svg [^>]* height="([0-9.]+)"/);
        const viewBoxMatch = rawIcons[set][symbol].match(/^<svg [^>]* viewBox="([ 0-9.]+)"/);

        const width = Number(widthMatch ? widthMatch[1] : viewBoxMatch![1].split(" ")[2]);
        const height = Number(heightMatch ? heightMatch[1] : viewBoxMatch![1].split(" ")[3]);
        const scale = size / sizes[set];
        const moveX = (sizes[set] - width) / 2;
        const moveY = (sizes[set] - height) / 2;
        const content = rawIcons[set][symbol].replace(/^<svg [^>]*>/, "").replace(/<\/svg>$/, "");

        return `<g transform="scale(${scale}) translate(${moveX}, ${moveY})" fill="${colour}">${content}</g>`;
    } else if (symbol && symbol.length == 1) {
        try {
            const offset = getLetterOffset(symbol);
            return (
                `<g transform="scale(${size / 25}) translate(${offset.x}, ${offset.y})">` +
                    `<text style="font-size: 25px; font-family: sans-serif; fill: #${colour}">${quoteHtml(symbol)}</text>` +
                `</g>`
            );
        } catch (e) {
            console.error("Error creating letter symbol.", e);
        }
    }
    
    return `<circle style="fill:${colour}" cx="${Math.floor(size / 2)}" cy="${Math.floor(size / 2)}" r="${Math.floor(size / 6)}" />`;
}

export function getSymbolUrl(colour: Colour, height: number, symbol?: Symbol): string {
    const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${height}" height="${height}" viewbox="0 0 24 24" version="1.1">` +
        getSymbolCode('#'+colour, 24, symbol) +
    `</svg>`;

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function getSymbolHtml(colour: Colour, height: number | string, symbol?: Symbol): string {
    return `<svg width="${height}" height="${height}" viewbox="0 0 24 24">` +
        getSymbolCode(colour, 24, symbol) +
    `</svg>`;
}

let idCounter = 0;

export function getMarkerCode(colour: Colour, height: number, symbol?: Symbol, shape?: Shape, highlight = false): string {
    const borderColour = makeTextColour(colour, 0.3);
    const id = `${idCounter++}`;

    const shapeObj = (shape && MARKER_SHAPES[shape]) || MARKER_SHAPES.drop!;
    const shapeCode = (highlight ? shapeObj.highlightSvg : shapeObj.svg)
        .replace(/%BORDER_COLOUR%/g, "#"+borderColour)
        .replace(/%COLOUR%/g, colour == "rainbow" ? `url(#fm-rainbow-${id})` : "#" + colour)
        .replace(/%SYMBOL%/g, getSymbolCode("#"+borderColour, 24, symbol))
        .replace(/%ID%/g, id);

    const scale = height / shapeObj.height;

    return (
        `<g transform="scale(${scale})">` +
            (colour == "rainbow" ? `<defs><linearGradient id="fm-rainbow-${id}" x2="0" y2="100%">${RAINBOW_STOPS}</linearGradient></defs>` : '') +
            shapeCode +
        `</g>`
    );
}

export function getMarkerUrl(colour: string, height: number, symbol?: Symbol, shape?: Shape, highlight = false): string {
    const shapeObj = (shape && MARKER_SHAPES[shape]) || MARKER_SHAPES.drop!;
    const width = Math.ceil(height * shapeObj.width / shapeObj.height);
    return "data:image/svg+xml,"+encodeURIComponent(
        `<?xml version="1.0" encoding="UTF-8" standalone="no"?>` +
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${shapeObj.width} ${shapeObj.height}" version="1.1">` +
            getMarkerCode(colour, shapeObj.height, symbol, shape, highlight) +
        `</svg>`
    );
}

export function getMarkerHtml(colour: string, height: number, symbol?: Symbol, shape?: Shape, highlight = false): string {
    const shapeObj = (shape && MARKER_SHAPES[shape]) || MARKER_SHAPES.drop!;
    const width = Math.ceil(height * shapeObj.width / shapeObj.height);
    return (
        `<svg width="${width}" height="${height}" viewBox="0 0 ${shapeObj.width} ${shapeObj.height}">` +
            getMarkerCode(colour, shapeObj.height, symbol, shape, highlight) +
        `</svg>`
    );
}

export function getMarkerIcon(colour: Colour, height: number, symbol?: Symbol, shape?: Shape, highlight = false): Icon {
    const scale = height / 31;
    const shapeObj = (shape && MARKER_SHAPES[shape]) || MARKER_SHAPES.drop!;
    return L.icon({
        iconUrl: getMarkerUrl(colour, height, symbol, shape, highlight),
        iconSize: [shapeObj.width*scale, shapeObj.height*scale],
        iconAnchor: [Math.round(shapeObj.baseX*scale), Math.round(shapeObj.baseY*scale)],
        popupAnchor: [0, -height]
    });
}