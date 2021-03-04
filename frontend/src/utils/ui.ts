import $ from 'jquery';
import './ui.scss';
import { deobfuscate } from "facilmap-utils";
import { Colour } from "facilmap-types";
import { RAINBOW_STOPS } from "facilmap-leaflet";

export function createLineGraphic(colour: Colour, width: number, length: number): string {
    return "data:image/svg+xml,"+encodeURIComponent(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>` +
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${length}" height="${width}" version="1.1">` +
        (colour == null ? `<defs><linearGradient id="rainbow" x2="100%" y2="0">${RAINBOW_STOPS}</linearGradient></defs>` : ``) +
        `<rect x="0" y="0" width="${length}" height="${width}" style="fill:${colour == null ? `url(#rainbow)` : `#${colour}`}"/>` +
        `</svg>`);
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