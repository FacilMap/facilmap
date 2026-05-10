import type { Colour, Stroke } from "facilmap-types";
import type { PolylineOptions } from "leaflet";
import { generatePolygonStyles, generatePolylineStyles, type HighlightableLayerOptions } from "leaflet-highlightable-layers";
import { getDashArrayForStroke } from "../lines/lines-layer";

const generateRegularPolylineStyles: HighlightableLayerOptions<PolylineOptions>["generateStyles"] = (options) => {
	const base = generatePolylineStyles(options);
	return {
		...base,
		outline: { ...base.outline, weight: options.weight! + 2 }
	};
};

const generateHighlightedPolylineStyles: HighlightableLayerOptions<PolylineOptions>["generateStyles"] = (options) => ({
	...generateRegularPolylineStyles(options),
	selection: {
		...options,
		color: "#ffffff",
		weight: options.weight! + 10,
		lhlZIndex: -1
	}
});

export function getPolylineStyles(data: { colour?: Colour; width?: number; stroke?: Stroke; highlight?: boolean }): HighlightableLayerOptions<PolylineOptions> {
	const width = data.width ?? 3;
	return {
		...data.colour ? {
			color: `#${data.colour}`
		} : {},
		weight: width,
		outlineColor: "#000000",
		// outlineWeight is set dynamically in generateStyles
		generateStyles: data.highlight ? generateHighlightedPolylineStyles : generateRegularPolylineStyles,
		raised: data.highlight,
		opacity: data.highlight ? 1 : 0.7,
		...data.stroke ? {
			dashArray: getDashArrayForStroke(data.stroke, width)
		} : {}
	};
}

const generateRegularPolygonStyles: HighlightableLayerOptions<PolylineOptions>["generateStyles"] = (options) => {
	const base = generatePolygonStyles(options);
	return {
		...base,
		main: { ...base.main, fillOpacity: 0 },
		fill: { ...base.fill, lhlZIndex: 5 },
		outline: { ...base.outline, weight: options.weight! + 2, lhlZIndex: 10 },
		border: { ...base.border, lhlZIndex: 20 }
	};
};

const generateHighlightedPolygonStyles: HighlightableLayerOptions<PolylineOptions>["generateStyles"] = (options) => ({
	...generateRegularPolygonStyles(options),
	selection: {
		...options,
		fill: false,
		color: "#ffffff",
		weight: options.weight! + 10,
		lhlZIndex: 8
	}
});

export function getPolygonStyles(data: { colour?: Colour; width?: number; stroke?: Stroke; highlight?: boolean }): HighlightableLayerOptions<PolylineOptions> {
	const width = data.width ?? 3;
	return {
		...data.colour ? {
			color: `#${data.colour}`
		} : {},
		weight: width,
		outlineColor: "#000000",
		// outlineWeight is set dynamically in generateStyles
		generateStyles: data.highlight ? generateHighlightedPolygonStyles : generateRegularPolygonStyles,
		raised: data.highlight,
		opacity: data.highlight ? 1 : 0.7,
		...data.stroke ? {
			dashArray: getDashArrayForStroke(data.stroke, width)
		} : {}
	};
}