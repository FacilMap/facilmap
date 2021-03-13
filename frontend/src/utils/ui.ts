import { RAINBOW_STOPS } from "facilmap-leaflet";
import { Colour } from "facilmap-types";
import { getUniqueId } from "./utils";

export function createLinePlaceholderHtml(colour: Colour, width: number, length: number): string {
	const rainbowId = (colour == "rainbow" && getUniqueId("fm-line-rainbow"));
    return (
        `<svg width="${length}" height="${width}">` +
			(rainbowId ? `<defs><linearGradient id="${rainbowId}" x2="100%" y2="0">${RAINBOW_STOPS}</linearGradient></defs>` : ``) +
			`<rect x="0" y="0" width="${length}" height="${width}" style="fill:${rainbowId ? `url(#${rainbowId})` : `#${colour}`}"/>` +
        `</svg>`
	);
}