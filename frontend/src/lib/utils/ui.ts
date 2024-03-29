import { RAINBOW_STOPS } from "facilmap-leaflet";
import { getUniqueId } from "./utils";
import type { Stroke } from "facilmap-types";
import { isBright } from "facilmap-utils";

function getLinePlaceholderDashArray(width: number, length: number, stroke: Stroke): string | undefined {
	if (stroke === "dotted") {
		// Fixed dashWidth = width, variable spacing >= 0.6 * width
		const dashWidth = width
		const minSpaceWidth = 0.6 * dashWidth;

		// (numberOfDashes * dashWidth) + ((numberOfDashes - 1) * minSpaceWidth) = length
		// (numberOfDashes * dashWidth) + (numberOfDashes * minSpaceWidth) - minSpaceWidth = length
		// numberOfDashes * (dashWidth + minSpaceWidth) = length + minSpaceWidth
		// numberOfDashes = (length + minSpaceWidth) / (dashWidth + minSpaceWidth)
		const numberOfDashes = Math.max(3, Math.floor((length + minSpaceWidth) / (dashWidth + minSpaceWidth)));

		const spaceWidth = (length - (dashWidth * numberOfDashes)) / (numberOfDashes - 1);
		return `${dashWidth - width} ${spaceWidth + width - 0.01}`;
	} else if (stroke === "dashed") {
		// At least 2 dashes, fixed dash/space ratio 1:0.6
		const minDashWidth = Math.max(2 * width, 5);
		const minSpaceWidth = minDashWidth * 0.6;
		const numberOfDashes = Math.floor((length + minSpaceWidth) / (minDashWidth + minSpaceWidth));

		if (numberOfDashes >= 2) {
			// numberOfDashes * dashWidth + (numberOfDashes - 1) * dashWidth * 0.6 = length
			// numberOfDashes * dashWidth + numberOfDashes * dashWidth * 0.6 - dashWidth * 0.6 = length
			// dashWidth * (numberOfDashes + numberOfDashes * 0.6 - 0.6) = length
			// dashWidth = length / (numberOfDashes + numberOfDashes * 0.6 - 0.6)
			// dashWidth = length / (1.6 * numberOfDashes - 0.6)
			const dashWidth = length / (1.6 * numberOfDashes - 0.6);
			const spaceWidth = dashWidth * 0.6;

			return `${dashWidth - width} ${spaceWidth + width - 0.01}`;
		} else {
			// Not enough space for 2 dashes with the minimum dash width.
			// Try to fit 2 dashes without minimum width at a dash/space ratio 1:0.6

			// 2 * dashWidth + 0.6 * dashWidth = length
			const dashWidth = length / 2.6;
			if (dashWidth >= width) {
				const spaceWidth = dashWidth * 0.6;
				return `${dashWidth - width} ${spaceWidth + width - 0.01}`;
			} else {
				// Not enough space to fit 2 dashes at 1:0.6
				// Show 2 dots with a variable space width
				const spaceWidth = length - (width * 2);
				return `0 ${spaceWidth + width - 0.01}`;
			}
		}
	}
}

export function createLinePlaceholderHtml(colour: string, width: number, length: number, stroke: Stroke): string {
	const rainbowId = (colour == "rainbow" && getUniqueId("fm-line-rainbow"));
	const renderBorder = colour !== "rainbow" && isBright(colour);

	const pathStyle = {
		"stroke": rainbowId ? `url(#${rainbowId})` : colour,
		"stroke-width": `${Math.max(0.8, width - (renderBorder ? 1 : 0))}px`,
		"stroke-linecap": "round",
		"stroke-dasharray": getLinePlaceholderDashArray(width, length, stroke),
	};

	const borderStyle = {
		...pathStyle,
		"stroke": "#000000",
		"stroke-width": `${width}px`
	};

	return (
		`<svg width="${length}" height="${width}">` +
			(rainbowId ? `<defs><linearGradient id="${rainbowId}" x2="100%" y2="0" gradientUnits="userSpaceOnUse">${RAINBOW_STOPS}</linearGradient></defs>` : ``) +
			(renderBorder ? `<path d="M${width / 2} ${width / 2} h${length - width}" style="${Object.entries(borderStyle).flatMap(([k, v]) => v ? [`${k}: ${v}`] : []).join("; ")}"/>` : "") +
			`<path d="M${width / 2} ${width / 2} h${length - width}" style="${Object.entries(pathStyle).flatMap(([k, v]) => v ? [`${k}: ${v}`] : []).join("; ")}"/>` +
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