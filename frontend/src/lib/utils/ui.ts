import { RAINBOW_STOPS } from "facilmap-leaflet";
import { getUniqueId } from "./utils";

export function createLinePlaceholderHtml(colour: string, width: number, length: number): string {
	const rainbowId = (colour == "rainbow" && getUniqueId("fm-line-rainbow"));
	return (
		`<svg width="${length}" height="${width}">` +
			(rainbowId ? `<defs><linearGradient id="${rainbowId}" x2="100%" y2="0">${RAINBOW_STOPS}</linearGradient></defs>` : ``) +
			`<rect x="0" y="0" width="${length}" height="${width}" style="fill:${rainbowId ? `url(#${rainbowId})` : colour}"/>` +
		`</svg>`
	);
}

export function getGridColumnsCount(grid: Element): number {
	// https://stackoverflow.com/a/58393617/242365
	return getComputedStyle(grid).getPropertyValue("grid-template-columns").split(" ").length;
}

export function arrowNavigation<V>(values: V[], value: V | undefined, grid: Element, event: KeyboardEvent): V | undefined {
	if (!["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.key) || event.shiftKey || event.ctrlKey || event.metaKey)
		return;
	if (["ArrowLeft", "ArrowRight"].includes(event.key) && (event.target as HTMLElement | undefined)?.closest("input:not(.fm-keyboard-navigation-exception)"))
		return;

	event.preventDefault();

	const columns = getGridColumnsCount(grid);
	const idx = value && values.includes(value) ? values.indexOf(value) : undefined;

	if (idx == null)
		return ["ArrowDown", "ArrowRight"].includes(event.key) ? values[0] : value;

	return values[idx + {
		ArrowUp: -columns,
		ArrowLeft: -1,
		ArrowDown: columns,
		ArrowRight: 1
	}[event.key]!] ?? value;
}