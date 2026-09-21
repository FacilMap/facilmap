import type { ID, Line, LinePointsEvent, LineTemplate, ObjectWithId, Point, Stroke, Type, Width } from "facilmap-types";
import { FeatureGroup, latLng, type LayerOptions, type Map as LeafletMap, Marker as LeafletMarker, type LatLngBounds, type LeafletMouseEvent } from "leaflet";
import { HighlightablePolyline } from "leaflet-highlightable-layers";
import { type BasicTrackPoints, disconnectSegmentsOutsideViewport, tooltipOptions, trackPointsToLatLngArray, fmToLeafletBbox, type LatLngWithIdx } from "../utils/leaflet";
import { formatElevation, getExtraInfoAtIdx, getTranslatedExtraInfoTypes, getTranslatedExtraInfoValues, numberKeys, quoteHtml } from "facilmap-utils";
import { addClickListener, type ClickListenerHandle } from "../click-listener/click-listener";
import type Client from "facilmap-client";
import { getPolylineStyles } from "../utils/styles";
import { LineString } from "locate-on-line";

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
	protected expectingClick: {
		id: ID;
		lineString?: LineString<L.LatLng[][]>;
		touchMode: boolean;
		dragMarker?: L.Marker;
		cancel: () => void;
	} | undefined = undefined;

	constructor(client: Client, options?: LinesLayerOptions) {
		super([], options);
		this.client = client;
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
		this.expectingClick?.cancel();

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

	endDrawLine(save = false): void {
		if (!this._endDrawLine)
			throw new Error("No drawing in process.");
		else
			this._endDrawLine(save);
	}

	protected _endDrawLine?: (save: boolean) => void;

	drawLine(lineTemplate: LineTemplate, onAddPoint?: (point: Point, points: Point[]) => void): Promise<Point[] | undefined> {
		return new Promise<Point[] | undefined>((resolve) => {
			const line: Line & { trackPoints: BasicTrackPoints } = {
				id: -1,
				mapId: "",
				top: 0,
				right: 0,
				bottom: 0,
				left: 0,
				distance: 0,
				time: null,
				ascent: null,
				descent: null,
				...lineTemplate,
				routePoints: [],
				trackPoints: [],
				extraInfo: {}
			};
			line.trackPoints = line.routePoints;

			const routePoints: Point[] = [];
			let handler: ClickListenerHandle | undefined = undefined;

			const addPoint = (pos: Point) => {
				routePoints.push(pos);
				line.routePoints.push(pos);
				if (line.routePoints.length == 1)
					line.routePoints.push(pos); // Will be updated by handleMouseMove
				this._addLine(line);
				handler = addClickListener(this._map, handleClick, handleMouseMove);

				onAddPoint?.(pos, routePoints);
			};

			const handleClick = (pos?: Point) => {
				if (isFinishing) {
					// Called by handler.cancel()
					return;
				}

				handler = undefined;
				if (pos) {
					if(routePoints.length > 0 && pos.lon == routePoints[routePoints.length-1].lon && pos.lat == routePoints[routePoints.length-1].lat)
						void finishLine(true);
					else
						addPoint(pos);
				} else {
					void finishLine(false);
				}
			};

			const handleMouseMove = (pos: Point) => {
				if(line.routePoints!.length > 0) {
					line.routePoints![line.routePoints!.length-1] = pos;
					this._addLine(line);
				}
			};

			const handleKeyDown = (e: KeyboardEvent) => {
				if (e.code === "Enter") {
					e.preventDefault();
					void finishLine(true);
				}
			};

			let isFinishing = false;

			const finishLine = async (save: boolean) => {
				isFinishing = true;
				if (handler)
					handler.cancel();
				document.removeEventListener("keydown", handleKeyDown);

				this._deleteLine(line);

				delete this._endDrawLine;

				if(save && routePoints.length >= 2)
					resolve(routePoints);
				else
					resolve(undefined);
			};

			document.addEventListener("keydown", handleKeyDown);
			handler = addClickListener(this._map, handleClick, handleMouseMove);

			this._endDrawLine = finishLine;
		});
	}

	expectLineClick(
		lineId: ID,
		touchMode: boolean,
		onFinish: (point: Point) => (void | boolean | Promise<void | boolean>),
		onUpdate?: (point: Point | undefined) => void
	): {
		finish: () => void;
		cancel: () => void;
	} {
		if (this.expectingClick) {
			throw new Error("Already expecting a line click.");
		}

		const handleClick = async (e: LeafletMouseEvent) => {
			if (e.propagatedFrom?.line?.id === lineId) {
				await finish(e.latlng);
			}
		};

		const handleMouseMove = !touchMode && ((e: LeafletMouseEvent) => {
			if (e.propagatedFrom?.line?.id === lineId && this.expectingClick) {
				const closest = this.expectingClick.lineString?.locate(e.latlng);
				if (closest && this.expectingClick.dragMarker) {
					this.expectingClick.dragMarker.setLatLng(closest.closest).addTo(this._map);
					onUpdate?.({ lat: closest.closest.lat, lon: closest.closest.lng });
				} else {
					this.expectingClick.dragMarker?.remove();
					onUpdate?.(undefined);
				}
			}
		});

		const handleMouseOut = !touchMode && ((e: LeafletMouseEvent) => {
			if (e.propagatedFrom?.line?.id === lineId && this.expectingClick) {
				if (this.expectingClick.dragMarker) {
					this.expectingClick.dragMarker.remove();
					onUpdate?.(undefined);
				}
			}
		});

		const handleMoveEnd = touchMode && (() => {
			if (this.expectingClick?.dragMarker && onUpdate) {
				const pos = this.expectingClick.dragMarker.getLatLng();
				if (this._map.getBounds().contains(pos)) {
					onUpdate({ lat: pos.lat, lon: pos.lng });
				} else {
					onUpdate(undefined);
				}
			}
		});

		this.addEventListener("click", handleClick);
		if (handleMouseMove) {
			this.addEventListener("mousemove", handleMouseMove);
		}
		if (handleMouseOut) {
			this.addEventListener("mouseout", handleMouseOut);
		}
		if (handleMoveEnd) {
			this._map.addEventListener("moveend", handleMoveEnd);
			this._map.addEventListener("zoomend", handleMoveEnd);
		}

		const cancel = () => {
			if (this.expectingClick !== expectingClick) {
				return;
			}

			this.removeEventListener("click", handleClick);
			if (handleMouseMove) {
				this.removeEventListener("mousemove", handleMouseMove);
			}
			if (handleMouseOut) {
				this.removeEventListener("mouseout", handleMouseOut);
			}
			if (handleMoveEnd) {
				this._map.removeEventListener("moveend", handleMoveEnd);
				this._map.removeEventListener("zoomend", handleMoveEnd);
			}

			this.expectingClick.dragMarker?.remove();

			this.expectingClick = undefined;
		};

		const finish = async (latlng?: L.LatLng) => {
			const pos = latlng ?? this.expectingClick?.dragMarker?.getLatLng();
			if (pos) {
				if (await onFinish({ lat: pos.lat, lon: pos.lng }) !== false) {
					cancel();
				}
			}
		};

		const expectingClick = this.expectingClick = {
			id: lineId,
			touchMode,
			cancel
		};

		this._updateLineClick();
		if (handleMoveEnd) {
			handleMoveEnd();
		}

		return {
			cancel,
			finish: async () => await finish()
		};
	}

	_updateLineClick(): void {
		if (this.expectingClick) {
			const latlngs = this.linesById[this.expectingClick.id]?.getLatLngs() as L.LatLng[][] | undefined;
			this.expectingClick.lineString = latlngs && LineString.hasTrackPoints(latlngs) ? new LineString(latlngs) : undefined;

			// Track points appearing for the first time: Add drag marker
			if (this.expectingClick.lineString && !this.expectingClick.dragMarker) {
				const point = this.expectingClick.lineString.locate(this._map.getCenter());
				this.expectingClick.dragMarker = new LeafletMarker(point.closest, {
					interactive: this.expectingClick.touchMode,
					draggable: this.expectingClick.touchMode,
					pane: "fm-raised-marker"
				}).on("drag", (e) => {
					const closest = this.expectingClick?.lineString?.locate((e as any).latlng as L.LatLng);
					if (closest) {
						this.expectingClick?.dragMarker?.setLatLng(closest.closest);
					}
				});
				if (this.expectingClick.touchMode) {
					this.expectingClick.dragMarker.addTo(this._map);
				}
			}
		}
	}

	protected _getLineTooltipHtml(line: Line & { trackPoints?: BasicTrackPoints }, pos: L.LatLng | undefined, highlight: boolean): string {
		const layer = this.linesById[line.id];
		if (!layer) {
			return "";
		}

		const nameHtml = quoteHtml(this.client.lines[line.id].name);
		const detailsHtml: string[] = [];

		if (pos && highlight && line.trackPoints && layer._fmTrackPoints) {
			const closest = new LineString(layer._fmTrackPoints).locate(pos);
			const closestIdx = layer._fmTrackPoints[Math.round(closest.idx)]?.fmIdx;
			if (closestIdx != null) {
				const closestPoint = line.trackPoints[closestIdx];
				if (closestPoint.ele != null) {
					detailsHtml.push(`Elevation: ${formatElevation(closestPoint.ele)}`);
				}

				if (line.extraInfo) {
					const extraInfo = getExtraInfoAtIdx(line.extraInfo, closestIdx);
					const types = getTranslatedExtraInfoTypes();
					const values = getTranslatedExtraInfoValues();
					for (const [type, value] of Object.entries(extraInfo)) {
						detailsHtml.push(`${quoteHtml(types[type])}: ${quoteHtml(values[type][value].text)}`);
					}
				}
			}
		}

		if (detailsHtml.length > 0) {
			return `<strong>${nameHtml}</strong>${detailsHtml.map((h) => `<br/>${h}`).join("")}`;
		} else {
			return nameHtml;
		}
	}

	protected _updateLineTooltip(line: Line & { trackPoints?: BasicTrackPoints }): void {
		this.linesById[line.id]?.setTooltipContent(this._getLineTooltipHtml(line, this.linesById[line.id]._fmLastHoverLatLng, line.id == null || this.highlightedLinesIds.has(line.id)));
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
					.bindTooltip("", { ...tooltipOptions, sticky: true, offset: [ 20, 0 ] })
					.on("tooltipopen", () => {
						// this.linesById[line.id].setTooltipContent(this._getLineTooltipHtml(line));
					})
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
		this._updateLineTooltip(line);

		const highlight = line.id == null || this.highlightedLinesIds.has(line.id);

		const style = getPolylineStyles({ ...line, highlight });

		(this.linesById[line.id] as any).line = line;

		// Set style before setting coordinates, so a new line doesn't have to be rendered twice
		if (Object.entries(style).some(([k, v]) => (this.linesById[line.id].realOptions as any)[k] !== v)) {
			this.linesById[line.id].setStyle(style);
		}

		this.linesById[line.id].setLatLngs(splitLatLngs);

		if (line.name && line.id != null) { // We don't want a popup for lines that we are drawing right now
			const quoted = quoteHtml(line.name);
			if (!this.linesById[line.id]._tooltip) {
				this.linesById[line.id].bindTooltip(quoted, { ...tooltipOptions, sticky: true, offset: [ 20, 0 ] });
			} else if (this.linesById[line.id]._tooltip!.getContent() !== quoted) {
				this.linesById[line.id].setTooltipContent(quoted);
			}
		} else if (this.linesById[line.id]._tooltip) {
			this.linesById[line.id].unbindTooltip();
		}

		if (!this.hasLayer(this.linesById[line.id]))
			this.addLayer(this.linesById[line.id]);

		if (this.expectingClick && this.expectingClick.id === line.id) {
			this._updateLineClick();
		}
	}

	protected _deleteLine(line: ObjectWithId): void {
		if(!this.linesById[line.id])
			return;

		this.removeLayer(this.linesById[line.id]);
		delete this.linesById[line.id];
	}

}