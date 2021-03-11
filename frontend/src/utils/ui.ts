import $ from 'jquery';
import './ui.scss';
import { deobfuscate } from "facilmap-utils";
import { Colour } from "facilmap-types";
import { RAINBOW_STOPS } from "facilmap-leaflet";
import { getUniqueId } from './utils';

export function createLinePlaceholderHtml(colour: Colour, width: number, length: number): string {
	const rainbowId = (colour == "rainbow" && getUniqueId("fm-line-rainbow"));
    return (
        `<svg width="${length}" height="${width}">` +
			(rainbowId ? `<defs><linearGradient id="${rainbowId}" x2="100%" y2="0">${RAINBOW_STOPS}</linearGradient></defs>` : ``) +
			`<rect x="0" y="0" width="${length}" height="${width}" style="fill:${rainbowId ? `url(#${rainbowId})` : `#${colour}`}"/>` +
        `</svg>`
	);
}

export function registerDeobfuscationHandlers(): void {
	const clickHandler = (e: JQuery.ClickEvent) => {
		deobfuscate($(e.target).closest(".emobf") as any);
	};

	const actionHandler = () => {
		$(".emobf,.emobf2").each(function() {
			deobfuscate($(this) as any);
		});

		$(document).off("click", ".emobf", clickHandler);
		$(document).off("mousemove", actionHandler);
		$(document).off("keydown", actionHandler);
	};

	$(document).on("click", ".emobf", clickHandler);
	$(document).one("mousemove", actionHandler);
	$(document).one("keydown", actionHandler);
}