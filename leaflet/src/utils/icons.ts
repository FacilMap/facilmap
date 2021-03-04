import { Colour, Shape, Symbol } from "facilmap-types";
import { makeTextColour, quoteHtml } from "facilmap-utils";
import L, { Icon } from "leaflet";

const rawIconsContext = require.context("../../assets/icons");
const rawIcons: Record<string, Record<string, string>> = {};
for (const key of rawIconsContext.keys() as string[]) {
    const [set, fname] = key.split("/").slice(-2);
    
    if (!rawIcons[set])
        rawIcons[set] = {};
    
    rawIcons[set][fname.replace(/\.svg$/, "")] = rawIconsContext(key);
}
const iconList = Object.keys(rawIcons).map((key) => Object.keys(rawIcons[key])).flat();

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
        svg: `<path style="stroke:%BORDER_COLOUR%;stroke-linecap:round;fill:%COLOUR%" d="m11.5 0.5c-7 0-11 4-11 11s9.9375 19 11 19 11-12 11-19-4-11-11-11z"/>
                <g transform="translate(2.9, 3.3)">%SYMBOL%</g>`,
        highlightSvg: `<path style="stroke:%BORDER_COLOUR%;stroke-width:3;stroke-linecap:round;fill:%COLOUR%" d="m11.5 0.5c-7 0-11 4-11 11s9.9375 19 11 19 11-12 11-19-4-11-11-11z"/>
                        <g transform="translate(2.9, 3.3)">%SYMBOL%</g>`,
        height: 31,
        width: 23,
        baseX: 12,
        baseY: 31
    },
    circle: {
        svg: `<circle style="stroke:%BORDER_COLOUR%;fill:%COLOUR%;" cx="13" cy="13" r="12.5" />
                <g transform="translate(4.642, 4.642)">%SYMBOL%</g>`,
        highlightSvg: `<circle style="stroke:%BORDER_COLOUR%;stroke-width:3;fill:%COLOUR%;" cx="13" cy="13" r="12.5" />
                <g transform="translate(4.642, 4.642)">%SYMBOL%</g>`,
        height: 26,
        width: 26,
        baseX: 13,
        baseY: 13
    }
};

const sizes: Record<string, number> = {
    osmi: 580,
    mdiconic: 1000,
    glyphicons: 1410
};

export function getIcon(colour: Colour, size: number, iconName: string): string | undefined {
    const set = Object.keys(rawIcons).filter((i) => (rawIcons[i][iconName]))[0];
    if(!set)
        return undefined;

    if(set == "osmi") {
        return `<g transform="scale(${size / sizes.osmi})">${rawIcons[set][iconName].replace(/#000/g, colour)}</g>`;
    }

    const div = document.createElement('div');
    div.innerHTML = rawIcons[set][iconName];
    const el = div.firstChild as SVGElement;
    const scale = size / sizes[set];
    const moveX = (sizes[set] - Number(el.getAttribute("width"))) / 2;
    const moveY = (sizes[set] - Number(el.getAttribute("height"))) / 2;

    return `<g transform="scale(${scale}) translate(${moveX}, ${moveY})" fill="${colour}">${el.innerHTML}</g>`;
}

export function getSymbolCode(colour: Colour, size: number, symbol?: Symbol): string {
    if(symbol && iconList.includes(symbol))
        return getIcon(colour, size, symbol)!;
    else if(symbol && symbol.length == 1)
        return `<text x="8.5" y="15" style="font-size:18px;text-anchor:middle;font-family:'Helvetica'"><tspan style="fill:${colour}">${quoteHtml(symbol)}</tspan></text>`;
    else
        return `<circle style="fill:${colour}" cx="8.6" cy="7.7" r="3" />`;
}

export function createSymbol(colour: Colour, height: number, symbol?: Symbol): string {
    const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${height}" height="${height}" version="1.1">` +
        getSymbolCode('#'+colour, height, symbol) +
    `</svg>`;

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function createSymbolHtml(colour: string, height: number | string, symbol?: Symbol): string {
    return `<svg width="${height}" height="${height}" viewbox="0 0 25 25">` +
        getSymbolCode(colour, 25, symbol) +
    `</svg>`;
}

export function createMarkerGraphic(colour = "ffffff", height: number, symbol?: Symbol, shape?: Shape, padding = 0, highlight = false): string {
    const borderColour = makeTextColour(colour, 0.3);
    padding = Math.max(padding, highlight ? 10 * height / 31 : 0);

    const shapeObj = (shape && MARKER_SHAPES[shape]) || MARKER_SHAPES.drop!;
    const shapeCode = (highlight ? shapeObj.highlightSvg : shapeObj.svg)
        .replace(/%BORDER_COLOUR%/g, "#"+borderColour)
        .replace(/%COLOUR%/g, colour == null ? "url(#rainbow)" : "#" + colour)
        .replace(/%SYMBOL%/g, getSymbolCode("#"+borderColour, 17, symbol));

    const scale = height / 31;

    return "data:image/svg+xml,"+encodeURIComponent(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>` +
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.ceil(shapeObj.width * scale) + padding*2}" height="${Math.ceil(shapeObj.height * scale) + padding*2}" version="1.1">` +
        (colour == null ? `<defs><linearGradient id="rainbow" x2="0" y2="100%">${RAINBOW_STOPS}</linearGradient></defs>` : ``) +
        `<g transform="translate(${padding} ${padding}) scale(${scale})">` +
        shapeCode +
        `</g>` +
        `</svg>`);
}

export function createMarkerIcon(colour: Colour, height: number, symbol?: Symbol, shape?: Shape, padding = 0, highlight = false): Icon {
    const scale = height / 31;
    padding = Math.max(padding, highlight ? 10 * scale : 0);
    const shapeObj = (shape && MARKER_SHAPES[shape]) || MARKER_SHAPES.drop!;
    return L.icon({
        iconUrl: createMarkerGraphic(colour, height, symbol, shape, padding, highlight),
        iconSize: [padding*2 + shapeObj.width*scale, padding*2 + shapeObj.height*scale],
        iconAnchor: [padding + Math.round(shapeObj.baseX*scale), padding + Math.round(shapeObj.baseY*scale)],
        popupAnchor: [0, -height]
    });
}