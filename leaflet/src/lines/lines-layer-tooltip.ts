import type { Line } from "facilmap-types";
import { LatLng, Layer, Path, type PointExpression } from "leaflet";
import { type BasicTrackPoints, tooltipOptions, type LatLngWithIdx } from "../utils/leaflet";
import { formatDistance, formatElevation, formatSteepness, getExtraInfoAfterIdx, getSteepnessAtIdx, getTranslatedExtraInfoTypes, getTranslatedExtraInfoValues, quoteHtml } from "facilmap-utils";
import { LineString, type PointLocation } from "locate-on-line";
import { getI18n } from "../utils/i18n";

declare module "leaflet" {
	interface Layer {
		_fmLineTooltip?: {
			getLine: () => SimpleLine | undefined;
			getLineString: () => LineStringWithTrackPoints | undefined;
			getOptions: () => LineTooltipOptions;
			getHoverPos: () => PointLocation<LatLng[][]> | undefined;
			fixed?: boolean;
			offset?: PointExpression;
		}
	}
}

type SimpleLine = Pick<Line, "distance" | "name" | "extraInfo"> & { trackPoints?: BasicTrackPoints };
type SimpleLayer = Layer;
export type LineTooltipOptions = { name: boolean; details: boolean };
export type LineStringWithTrackPoints = LineString<LatLng[][]> & { _fmTrackPoints: LatLngWithIdx[][] };

export default class LinesLayerTooltip {

	getLineTooltipHtml(line: SimpleLine, lineString: LineStringWithTrackPoints, location: PointLocation<LatLng[][]> | undefined, options: LineTooltipOptions): string {
		const i18n = getI18n();
		const details: Array<{ name?: string; value: string }> = [];

		if (location && options.details && line.trackPoints) {
			const trackPointSection = lineString._fmTrackPoints[location.idx[0]];
			const i1 = location.idx[1];
			const i1Rounded = Math.round(i1);
			const i1Before = Math.floor(i1);
			const i1After = Math.ceil(i1);
			const idxRounded = trackPointSection[i1Rounded].fmIdx;
			const idxBefore = trackPointSection[i1Before].fmIdx;
			const idxAfter = trackPointSection[i1After].fmIdx;
			const pointBefore = line.trackPoints[idxBefore];
			const pointAfter = line.trackPoints[idxAfter];
			const fraction = i1 - i1Before;

			if (pointBefore?.km != null && pointAfter?.km != null) {
				const km = i1Before === i1After ? pointBefore.km : ((1 - fraction) * pointBefore.km + fraction * pointAfter.km);
				details.push({
					value: `${formatDistance(km)} / ${formatDistance(line.distance - km)}`
				});
			}

			if (pointBefore?.ele != null && pointAfter?.ele != null) {
				const ele = i1Before === i1After ? pointBefore.ele : ((1 - fraction) * pointBefore.ele + fraction * pointAfter.ele);
				details.push({
					name: i18n.t("lines-layer.elevation"),
					value: formatElevation(ele)
				});
			}

			const fractionalIdx = idxBefore + fraction;
			const steepness = getSteepnessAtIdx(line.trackPoints, fractionalIdx);
			if (steepness != null) {
				details.push({
					name: i18n.t("lines-layer.steepness"),
					value: formatSteepness(steepness)
				});
			}

			if (line.extraInfo) {
				const isBeforeIdxRounded = i1Rounded > i1 || i1 === trackPointSection.length - 1;
				const extraInfo = getExtraInfoAfterIdx(line.extraInfo, idxRounded - (isBeforeIdxRounded ? 1 : 0));
				const types = getTranslatedExtraInfoTypes();
				const values = getTranslatedExtraInfoValues();
				for (const [type, value] of Object.entries(extraInfo)) {
					if (type !== "steepness") {
						details.push({
							name: types[type],
							value: values[type][value].text
						});
					}
				}
			}
		}

		const itemsHtml = details.map(({ name, value }) => name ? i18n.t("lines-layer.detail", { name: quoteHtml(name), value: quoteHtml(value) }) : quoteHtml(value));

		if (options.name && line.name) {
			const nameHtml = quoteHtml(line.name);
			if (itemsHtml.length > 0) {
				itemsHtml.unshift(`<strong>${nameHtml}</strong>`);
			} else {
				itemsHtml.unshift(nameHtml);
			}
		}

		return itemsHtml.join("<br/>");
	}

	updateLineTooltip(layer: SimpleLayer): void {
		const closest = layer._fmLineTooltip?.getHoverPos();
		const line = layer._fmLineTooltip?.getLine();
		const lineString = layer._fmLineTooltip?.getLineString();
		if (layer._fmLineTooltip && closest && line && lineString) {
			const tooltipHtml = this.getLineTooltipHtml(line, lineString, closest, layer._fmLineTooltip.getOptions());
			if (tooltipHtml) {
				if (!layer._tooltip) {
					layer.bindTooltip(tooltipHtml, { ...tooltipOptions, permanent: true, ...layer._fmLineTooltip.offset ? { offset: layer._fmLineTooltip.offset } : {} });
				}
				layer.setTooltipContent(tooltipHtml);
				if (!layer._fmLineTooltip.fixed) {
					layer._tooltip!.setLatLng(closest.latlng);
				}
				return;
			}
		}

		layer.unbindTooltip();
	}

	registerLineTooltip(layer: SimpleLayer, { getLine, getLineString, getOptions, getHoverPos, fixed, offset }: {
		getLine: () => SimpleLine | undefined;
		getLineString: () => LineString<LatLng[][]> & { _fmTrackPoints: LatLngWithIdx[][] } | undefined;
		getOptions: () => LineTooltipOptions;
		getHoverPos?: () => PointLocation<LatLng[][]> | undefined;
		/** If true, the tooltip should stay at a fixed position in relation to the layer. If false, it will be positioned at the hover pos. */
		fixed?: boolean;
		offset?: PointExpression;
	}): void {
		let hoverPos: PointLocation<LatLng[][]> | undefined;
		layer._fmLineTooltip = { getLine, getLineString, getOptions, getHoverPos: getHoverPos ?? (() => hoverPos), fixed, offset };

		if (getHoverPos) {
			this.updateLineTooltip(layer);
		} else if (layer instanceof Path) {
			const over = (e: Event) => {
				if ((e as PointerEvent).pointerType !== "touch") {
					const latlng = layer["_map"].mouseEventToLatLng(e as any);
					hoverPos = getLineString()?.locate(latlng);
					this.updateLineTooltip(layer);
				}
			};

			const out = (e: Event) => {
				if ((e as PointerEvent).pointerType !== "touch") {
					hoverPos = undefined;
					this.updateLineTooltip(layer);
				}
			};

			// Leaflet 1 does not support pointer events yet, so we need to add the listeners manually
			const addEvents = () => {
				const path = layer.getElement();
				if (path) {
					path.addEventListener("pointerover", over);
					path.addEventListener("pointermove", over);
					path.addEventListener("pointerout", out);
				}
			};

			layer.on("add", () => {
				addEvents();
			});
			addEvents();
		}
	}

}