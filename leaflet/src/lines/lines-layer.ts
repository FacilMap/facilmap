import type { ID, Line, LinePointsEvent, ObjectWithId, Point } from "facilmap-types";
import { FeatureGroup, latLng, type LayerOptions, Map, type PolylineOptions } from "leaflet";
import { type HighlightableLayerOptions, HighlightablePolyline } from "leaflet-highlightable-layers";
import { type BasicTrackPoints, disconnectSegmentsOutsideViewport, tooltipOptions, trackPointsToLatLngArray } from "../utils/leaflet";
import { numberKeys, quoteHtml } from "facilmap-utils";
import { addClickListener, type ClickListenerHandle } from "../click-listener/click-listener";
import type Client from "facilmap-client";

interface LinesLayerOptions extends LayerOptions {
}

export default class LinesLayer extends FeatureGroup {

	declare options: LayerOptions;
	client: Client;
	linesById: Record<string, InstanceType<typeof HighlightablePolyline>> = {};
	highlightedLinesIds = new Set<ID>();
	hiddenLinesIds = new Set<ID>();

	constructor(client: Client, options?: LinesLayerOptions) {
		super([], options);
		this.client = client;
	}

	onAdd(map: Map): this {
		super.onAdd(map);

		this.client.on("line", this.handleLine);
		this.client.on("linePoints", this.handleLinePoints);
		this.client.on("deleteLine", this.handleDeleteLine);

		map.on("moveend", this.handleMoveEnd);
		map.on("fmFilter", this.handleFilter);

		if (map._loaded)
			this.handleMoveEnd();

		return this;
	}

	onRemove(map: Map): this {
		super.onRemove(map);

		this.client.removeListener("line", this.handleLine);
		this.client.removeListener("linePoints", this.handleLinePoints);
		this.client.removeListener("deleteLine", this.handleDeleteLine);

		map.off("moveend", this.handleMoveEnd);
		map.off("fmFilter", this.handleFilter);

		return this;
	}

	shouldShowLine(line: Line): boolean {
		return !this.hiddenLinesIds.has(line.id) && this._map.fmFilterFunc(line, this.client.types[line.typeId]);
	}

	handleLine = (line: Line): void => {
		if(this.shouldShowLine(line))
			this._addLine(this.client.lines[line.id]);
	};

	handleLinePoints = (event: LinePointsEvent): void => {
		const line = this.client.lines[event.id];
		if(line && this.shouldShowLine(line))
			this._addLine(this.client.lines[line.id]);
	};

	handleDeleteLine = (data: ObjectWithId): void => {
		this._deleteLine(data);
	};

	handleMoveEnd = (): void => {
		// Rerender all lines to recall disconnectSegmentsOutsideViewport()
		// Run it on next tick because the renderers need to run first
		Promise.resolve().then(() => {
			for(const i of numberKeys(this.client.lines)) {
				if (this.shouldShowLine(this.client.lines[i]))
					this._addLine(this.client.lines[i]);
			}
		});
	};

	handleFilter = (): void => {
		for(const i of numberKeys(this.client.lines)) {
			const show = this.shouldShowLine(this.client.lines[i]);
			if(this.linesById[i] && !show)
				this._deleteLine(this.client.lines[i]);
			else if(!this.linesById[i] && show)
				this._addLine(this.client.lines[i]);
		}
	};

	highlightLine(id: ID): void {
		this.highlightedLinesIds.add(id);
		if (this.client.lines[id])
			this.handleLine(this.client.lines[id]);
	}

	unhighlightLine(id: ID): void {
		this.highlightedLinesIds.delete(id);
		if (this.client.lines[id])
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

	_endDrawLine?: (save: boolean) => void;

	drawLine(lineTemplate: Line): Promise<Point[] | undefined> {
		return new Promise<Point[] | undefined>((resolve) => {
			const line: Line & { trackPoints: BasicTrackPoints } = {
				...lineTemplate,
				routePoints: [],
				trackPoints: []
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
			};

			const handleClick = (pos: Point) => {
				handler = undefined;
				if(routePoints.length > 0 && pos.lon == routePoints[routePoints.length-1].lon && pos.lat == routePoints[routePoints.length-1].lat)
					finishLine(true);
				else
					addPoint(pos);
			}

			const handleMouseMove = (pos: Point) => {
				if(line.routePoints!.length > 0) {
					line.routePoints![line.routePoints!.length-1] = pos;
					this._addLine(line);
				}
			}

			const finishLine = async (save: boolean) => {
				if (handler)
					handler.cancel();
				this._deleteLine(line);

				delete this._endDrawLine;

				if(save && routePoints.length >= 2)
					resolve(routePoints);
				else
					resolve(undefined);
			}

			handler = addClickListener(this._map, handleClick, handleMouseMove)

			this._endDrawLine = finishLine;
		});
	}

	_addLine(line: Line & { trackPoints?: BasicTrackPoints }): void {
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
			opacity: 0.35
		} as any;

		if(line.id == null || this.highlightedLinesIds.has(line.id)) {
			Object.assign(style, {
				raised: true,
				opacity: 1
			});
		}

		(this.linesById[line.id] as any).line = line;
		this.linesById[line.id].setLatLngs(splitLatLngs).setStyle(style);

		if (line.name && line.id != null) { // We don't want a popup for lines that we are drawing right now
			const quoted = quoteHtml(line.name);
			if (this.linesById[line.id]._tooltip) {
				this.linesById[line.id].setTooltipContent(quoted);
			} else {
				this.linesById[line.id].bindTooltip(quoted, { ...tooltipOptions, sticky: true, offset: [ 20, 0 ] });
			}
		} else if (this.linesById[line.id]._tooltip) {
			this.linesById[line.id].unbindTooltip();
		}

		if (!this.hasLayer(this.linesById[line.id]))
			this.addLayer(this.linesById[line.id]);
	}

	_deleteLine(line: ObjectWithId): void {
		if(!this.linesById[line.id])
			return;

		this.removeLayer(this.linesById[line.id]);
		delete this.linesById[line.id];
	}

}