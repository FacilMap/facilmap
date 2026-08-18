import { RAINBOW_STOPS } from "facilmap-leaflet";
import { getUniqueId } from "./utils";
import type { Stroke } from "facilmap-types";

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

export function createLinePlaceholderHtml(options: { colour: string; width: number; length: number; stroke: Stroke; arrowRight?: boolean; border?: boolean }): string {
	const rainbowId = (options.colour == "rainbow" && getUniqueId("fm-line-rainbow"));
	const renderBorder = options.border ?? true;
	const borderWidth = renderBorder ? 0.5 : 0;

	const pathStyle = {
		"stroke": rainbowId ? `url(#${rainbowId})` : options.colour,
		"stroke-width": `${Math.max(0.8, options.width - 2 * borderWidth)}px`,
		"stroke-linecap": "round",
		"stroke-dasharray": getLinePlaceholderDashArray(options.width, options.length, options.stroke),
		toString(): string {
			return Object.entries(this).flatMap(([k, v]) => k !== "toString" && v ? [`${k}: ${v}`] : []).join("; ");
		}
	};

	const borderStyle = {
		...pathStyle,
		"stroke": "#000000",
		"stroke-width": options.width
	};

	const height = options.arrowRight ? options.width * 3 : options.width + 1;
	const path = `M${options.width / 2 + borderWidth} ${height / 2} H${options.length - options.width - borderWidth - (options.arrowRight ? options.width * 2 : 0)}`;
	const arrowPath = options.arrowRight ? `M ${options.length - height + borderWidth} ${borderWidth} L ${options.length - 2*borderWidth} ${height / 2} L ${options.length - height + borderWidth} ${height - borderWidth} Z` : undefined;

	return (
		`<svg width="${options.length}" height="${height}">` +
			(rainbowId ? `<defs><linearGradient id="${rainbowId}" x2="100%" y2="0" gradientUnits="userSpaceOnUse">${RAINBOW_STOPS}</linearGradient></defs>` : ``) +
			(renderBorder ? (
				`<path d="${path}" style="${borderStyle}"/>` +
				`<path d="${arrowPath}" style="stroke: #000; stroke-width: ${borderWidth * 2}; paint-order: stroke fill"/>`
			) : "") +
			`<path d="${path}" style="${pathStyle}"/>` +
			(arrowPath ? `<path d="${arrowPath}" style="fill: ${rainbowId ? `url(#${rainbowId})` : options.colour}"/>` : "") +
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