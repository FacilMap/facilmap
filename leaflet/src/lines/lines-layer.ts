import type { ID, Line, LinePointsEvent, LineTemplate, ObjectWithId, Point, Stroke, Type, Width } from "facilmap-types";
import { FeatureGroup, latLng, type LayerOptions, type Map as LeafletMap, type PolylineOptions, type LatLngBounds } from "leaflet";
import { type HighlightableLayerOptions, HighlightablePolyline } from "leaflet-highlightable-layers";
import { type BasicTrackPoints, disconnectSegmentsOutsideViewport, tooltipOptions, trackPointsToLatLngArray, fmToLeafletBbox } from "../utils/leaflet";
import { numberKeys, quoteHtml } from "facilmap-utils";
import { addClickListener, type ClickListenerHandle } from "../click-listener/click-listener";
import type Client from "facilmap-client";

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
	protected linesById: Record<string, InstanceType<typeof HighlightablePolyline>> = {};
	protected highlightedLinesIds = new Set<ID>();
	protected hiddenLinesIds = new Set<ID>();
	protected lastMapBounds?: LatLngBounds;
	protected filterResults = new Map<ID, boolean>();

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

	protected handleLine = (line: Line): void => {
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
				padId: "",
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

	protected _addLine(line: Line & { trackPoints?: BasicTrackPoints }): void {
		const trackPoints = line.mode ? trackPointsToLatLngArray(line.trackPoints) : line.routePoints.map((p) => latLng(p.lat, p.lon));

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
						this.linesById[line.id].setTooltipContent(quoteHtml(this.client.lines[line.id].name));
					});
			}
		}

		const style: HighlightableLayerOptions<PolylineOptions> = {
			color: '#'+line.colour,
			weight: line.width,
			raised: false,
			opacity: 0.35,
			dashArray: getDashArrayForStroke(line.stroke, line.width)
		};

		if(line.id == null || this.highlightedLinesIds.has(line.id)) {
			Object.assign(style, {
				raised: true,
				opacity: 1
			});
		}

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
	}

	protected _deleteLine(line: ObjectWithId): void {
		if(!this.linesById[line.id])
			return;

		this.removeLayer(this.linesById[line.id]);
		delete this.linesById[line.id];
	}

}