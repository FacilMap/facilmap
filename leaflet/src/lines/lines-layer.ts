import type { ID, Line, LinePointsEvent, ObjectWithId, Stroke, Type, Width } from "facilmap-types";
import { FeatureGroup, latLng, type LayerOptions, type Map as LeafletMap, type LatLngBounds } from "leaflet";
import { HighlightablePolyline } from "leaflet-highlightable-layers";
import { type BasicTrackPoints, disconnectSegmentsOutsideViewport, tooltipOptions, trackPointsToLatLngArray, fmToLeafletBbox, type LatLngWithIdx } from "../utils/leaflet";
import { formatElevation, formatSteepness, getExtraInfoAfterIdx, getSteepnessAtIdx, getTranslatedExtraInfoTypes, getTranslatedExtraInfoValues, numberKeys, quoteHtml } from "facilmap-utils";
import type Client from "facilmap-client";
import { getPolylineStyles } from "../utils/styles";
import { LineString } from "locate-on-line";
import LinesLayerClick from "./lines-layer-click";
import LinesLayerDraw from "./lines-layer-draw";
import { getI18n } from "../utils/i18n";

export function getDashArrayForStroke(stroke: Stroke, width: Width): string | undefined {
	if (stroke === "dashed") {
		return `${Math.max(5, width)} ${width * 2}`;
	} else if (stroke === "dotted") {
		return `0 ${Math.round(width * 1.6)}`;
	}
}

interface LinesLayerOptions extends LayerOptions {
}

export default class LinesLayer extends FeatureGroup {

	declare options: LayerOptions;
	protected client: Client;
	protected linesById: Record<string, InstanceType<typeof HighlightablePolyline> & {
		_fmTrackPoints?: LatLngWithIdx[];
		_fmLastHoverLatLng?: L.LatLng;
	}> = {};
	protected highlightedLinesIds = new Set<ID>();
	protected hiddenLinesIds = new Set<ID>();
	protected lastMapBounds?: LatLngBounds;
	protected filterResults = new Map<ID, boolean>();
	protected click: LinesLayerClick;
	protected draw: LinesLayerDraw;

	constructor(client: Client, options?: LinesLayerOptions) {
		super([], options);
		this.client = client;
		this.click = new LinesLayerClick(this);
		this.draw = new LinesLayerDraw(this);
	}

	onAdd(map: LeafletMap): this {
		super.onAdd(map);

		this.client.on("line", this.handleLine);
		this.client.on("linePoints", this.handleLinePoints);
		this.client.on("deleteLine", this.handleDeleteLine);
		this.client.on("type", this.handleType);

		map.on("moveend", this.handleMoveEnd);
		map.on("fmFilter", this.handleFilter);

		if (map._loaded) {
			this.lastMapBounds = this._map.getBounds();
		}

		for (const lineId of numberKeys(this.client.lines)) {
			this.handleLine(this.client.lines[lineId]);
		}

		return this;
	}

	onRemove(map: LeafletMap): this {
		this.click.dispose();

		super.onRemove(map);

		this.client.removeListener("line", this.handleLine);
		this.client.removeListener("linePoints", this.handleLinePoints);
		this.client.removeListener("deleteLine", this.handleDeleteLine);
		this.client.removeListener("type", this.handleType);

		map.off("moveend", this.handleMoveEnd);
		map.off("fmFilter", this.handleFilter);

		return this;
	}

	protected recalculateFilter(line: Line): void {
		this.filterResults.set(line.id, this._map.fmFilterFunc(line, this.client.types[line.typeId]));
	}

	protected shouldShowLine(line: Line): boolean {
		return !this.hiddenLinesIds.has(line.id) && !!this.filterResults.get(line.id);
	}

	protected handleLine = (line_: Line): void => {
		// Line from event doesn't have track points
		const line = this.client.lines[line_.id];

		this.recalculateFilter(line);

		if(this.shouldShowLine(line))
			this._addLine(line);
		else
			this._deleteLine(line);
	};

	protected handleLinePoints = (event: LinePointsEvent): void => {
		const line = this.client.lines[event.id];
		if(line && this.shouldShowLine(line))
			this._addLine(line);
	};

	protected handleDeleteLine = (data: ObjectWithId): void => {
		this._deleteLine(data);
		this.filterResults.delete(data.id);
	};

	protected handleType = (type: Type): void => {
		for (const lineId of numberKeys(this.client.lines)) {
			if (this.client.lines[lineId].typeId === type.id) {
				this.recalculateFilter(this.client.lines[lineId]);
			}
		}
	};

	protected handleMoveEnd = (): void => {
		// Rerender all lines to recall disconnectSegmentsOutsideViewport()
		// Run it on next tick because the renderers need to run first
		void Promise.resolve().then(() => {
			const lastMapBounds = this.lastMapBounds;
			const mapBounds = this.lastMapBounds = this._map.getBounds();
			for(const lineId of numberKeys(this.client.lines)) {
				const lineBounds = fmToLeafletBbox(this.client.lines[lineId]);
				if (
					(
						// We do not have to do this for lines that are either completely outside or completely within the
						// previous and current map bbox.
						!lastMapBounds ||
						!(
							(lastMapBounds.contains(lineBounds) && mapBounds.contains(lineBounds)) ||
							(!lastMapBounds.intersects(lineBounds) && !mapBounds.intersects(lineBounds))
						)
					) && this.shouldShowLine(this.client.lines[lineId])
				) {
					this._addLine(this.client.lines[lineId]);
				}
			}
		});
	};

	protected handleFilter = (): void => {
		for(const lineId of numberKeys(this.client.lines)) {
			this.recalculateFilter(this.client.lines[lineId]);
			const show = this.shouldShowLine(this.client.lines[lineId]);
			if(this.linesById[lineId] && !show)
				this._deleteLine(this.client.lines[lineId]);
			else if(!this.linesById[lineId] && show)
				this._addLine(this.client.lines[lineId]);
		}
	};

	highlightLine(id: ID): void {
		this.highlightedLinesIds.add(id);
		if (this._map && this.client.lines[id])
			this.handleLine(this.client.lines[id]);
	}

	unhighlightLine(id: ID): void {
		this.highlightedLinesIds.delete(id);
		if (this._map && this.client.lines[id])
			this.handleLine(this.client.lines[id]);
	}

	setHighlightedLines(ids: Set<ID>): void {
		for (const id of this.highlightedLinesIds) {
			if (!ids.has(id))
				this.unhighlightLine(id);
		}

		for (const id of ids) {
			if (!this.highlightedLinesIds.has(id))
				this.highlightLine(id);
		}
	}

	hideLine(id: ID): void {
		this.hiddenLinesIds.add(id);
		if (this.client.lines[id])
			this._deleteLine(this.client.lines[id]);
	}

	unhideLine(id: ID): void {
		this.hiddenLinesIds.delete(id);
		if (this.client.lines[id])
			this.handleLine(this.client.lines[id]);
	}

	drawLine(...args: Parameters<LinesLayerDraw["drawLine"]>): ReturnType<LinesLayerDraw["drawLine"]> {
		return this.draw.drawLine(...args);
	}

	endDrawLine(...args: Parameters<LinesLayerDraw["endDrawLine"]>): ReturnType<LinesLayerDraw["endDrawLine"]> {
		return this.draw.endDrawLine(...args);
	}

	expectLineClick(...args: Parameters<LinesLayerClick["expectLineClick"]>): ReturnType<LinesLayerClick["expectLineClick"]> {
		return this.click.expectLineClick(...args);
	}

	protected _getLineTooltipHtml(line: Line & { trackPoints?: BasicTrackPoints }, pos: L.LatLng | undefined, options: { name: boolean; details: boolean }): string {
		const layer = this.linesById[line.id];
		if (!layer) {
			return "";
		}

		const i18n = getI18n();
		const details: Array<{ name: string; value: string }> = [];

		if (pos && options.details && line.trackPoints && layer._fmTrackPoints) {
			const closest = new LineString(layer._fmTrackPoints).locate(pos);
			const roundedIdx = Math.round(closest.idx);
			const closestIdx = layer._fmTrackPoints[roundedIdx]?.fmIdx;
			if (closestIdx != null) {

				const idxBefore = Math.floor(closest.idx);
				const idxAfter = Math.ceil(closest.idx);
				const pointBefore = line.trackPoints[layer._fmTrackPoints[idxBefore].fmIdx];
				const pointAfter = line.trackPoints[layer._fmTrackPoints[idxAfter].fmIdx];
				if (pointBefore?.ele != null && pointAfter?.ele != null) {
					const ele = idxBefore === idxAfter ? pointBefore.ele : ((idxAfter - closest.idx) * pointBefore.ele + (closest.idx - idxBefore) * pointAfter.ele);
					details.push({
						name: i18n.t("lines-layer.elevation"),
						value: formatElevation(ele)
					});
				}

				const idx = layer._fmTrackPoints[idxBefore].fmIdx + closest.idx - Math.floor(closest.idx);
				const steepness = getSteepnessAtIdx(line.trackPoints, idx);
				if (steepness != null) {
					details.push({
						name: i18n.t("lines-layer.steepness"),
						value: formatSteepness(steepness)
					});
				}

				if (line.extraInfo) {
					const extraInfo = getExtraInfoAfterIdx(line.extraInfo, closestIdx - (roundedIdx > closest.idx || closest.idx === layer._fmTrackPoints.length - 1 ? 1 : 0));
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
		}

		const itemsHtml = details.map(({ name, value }) => i18n.t("lines-layer.detail", { name, value }));

		if (options.name && this.client.lines[line.id].name) {
			const nameHtml = quoteHtml(this.client.lines[line.id].name);
			if (itemsHtml.length > 0) {
				itemsHtml.unshift(`<strong>${nameHtml}</strong>`);
			} else {
				itemsHtml.unshift(nameHtml);
			}
		}

		return itemsHtml.join("<br/>");
	}

	protected _updateLineTooltip(line: Line & { trackPoints?: BasicTrackPoints }): void {
		// line.id == null: We are currently drawing the line, don't render a tooltip

		const tooltipHtml = line.id != null && this._getLineTooltipHtml(line, this.linesById[line.id]._fmLastHoverLatLng, { name: true, details: this.highlightedLinesIds.has(line.id) });
		if (!tooltipHtml) {
			this.linesById[line.id].unbindTooltip();
		} else if (!this.linesById[line.id]._tooltip) {
			this.linesById[line.id].bindTooltip(tooltipHtml, { ...tooltipOptions, sticky: true, offset: [ 20, 0 ] });
		} else if (this.linesById[line.id]._tooltip!.getContent() !== tooltipHtml) {
			this.linesById[line.id].setTooltipContent(tooltipHtml);
		}
	}

	protected _addLine(line: Line & { trackPoints?: BasicTrackPoints }): void {
		const trackPoints: LatLngWithIdx[] = (
			line.mode ? trackPointsToLatLngArray(line.trackPoints) :
			line.routePoints.map((p, i) => Object.assign(latLng(p.lat, p.lon), { fmIdx: i }))
		);

		// Two points that are both outside of the viewport should not be connected, as the piece in between
		// has not been received.
		const splitLatLngs = line.mode ? disconnectSegmentsOutsideViewport(trackPoints, this._map.getBounds()) : [trackPoints];

		if(splitLatLngs.length == 0) {
			this._deleteLine(line);
			return;
		}

		if(!this.linesById[line.id]) {
			this.linesById[line.id] = new HighlightablePolyline([ ]);

			if(line.id != null) {
				this.linesById[line.id]
					.on("mousemove", (e) => {
						this.linesById[line.id]._fmLastHoverLatLng = e.latlng;
						this._updateLineTooltip(line);
					})
					.on("mouseout", (e) => {
						this.linesById[line.id]._fmLastHoverLatLng = undefined;
					});
			}
		}

		this.linesById[line.id]._fmTrackPoints = trackPoints;

		const highlight = line.id == null || this.highlightedLinesIds.has(line.id);

		const style = getPolylineStyles({ ...line, highlight });

		(this.linesById[line.id] as any).line = line;

		// Set style before setting coordinates, so a new line doesn't have to be rendered twice
		if (Object.entries(style).some(([k, v]) => (this.linesById[line.id].realOptions as any)[k] !== v)) {
			this.linesById[line.id].setStyle(style);
		}

		this.linesById[line.id].setLatLngs(splitLatLngs);

		if (!this.hasLayer(this.linesById[line.id]))
			this.addLayer(this.linesById[line.id]);

		this._updateLineTooltip(line);

		this.click.handleLineUpdate(line.id);
	}

	protected _deleteLine(line: ObjectWithId): void {
		if(!this.linesById[line.id])
			return;

		this.removeLayer(this.linesById[line.id]);
		delete this.linesById[line.id];
	}

}