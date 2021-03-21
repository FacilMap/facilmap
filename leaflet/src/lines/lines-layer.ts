import Client from "facilmap-client";
import { ID, Line, LinePointsEvent, ObjectWithId, Point } from "facilmap-types";
import { FeatureGroup, LayerOptions, Map, PolylineOptions } from "leaflet";
import { HighlightableLayerOptions, HighlightablePolyline } from "leaflet-highlightable-layers";
import { BasicTrackPoints, disconnectSegmentsOutsideViewport, tooltipOptions, trackPointsToLatLngArray } from "../utils/leaflet";
import { quoteHtml } from "facilmap-utils";
import { addClickListener, ClickListenerHandle } from "../click-listener/click-listener";

interface LinesLayerOptions extends LayerOptions {
}

export default class LinesLayer extends FeatureGroup {

	options!: LayerOptions;
	client: Client;
	linesById: Record<string, InstanceType<typeof HighlightablePolyline>> = {};
	highlightedLinesIds = new Set<ID>();

	constructor(client: Client, options?: LinesLayerOptions) {
		super([], options);
		this.client = client;
	}

	onAdd(map: Map): this {
		super.onAdd(map);

		this.client.on("line", this.handleLine);
		this.client.on("linePoints", this.handleLinePoints);
		this.client.on("deleteLine", this.handleDeleteLine);

		map.on("fmFilter", this.handleFilter);

		return this;
	}

	onRemove(map: Map): this {
		super.onRemove(map);

		this.client.removeListener("line", this.handleLine);
		this.client.removeListener("linePoints", this.handleLinePoints);
		this.client.removeListener("deleteLine", this.handleDeleteLine);

		map.off("fmFilter", this.handleFilter);

		return this;
	}

	handleLine = (line: Line): void => {
		if(this._map.fmFilterFunc(line))
			this._addLine(line);
	};

	handleLinePoints = (event: LinePointsEvent): void => {
		const line = this.client.lines[event.id];
		if(line && this._map.fmFilterFunc(line))
			this._addLine(line);
	};

	handleDeleteLine = (data: ObjectWithId): void => {
		this._deleteLine(data);
	};

	handleFilter = (): void => {
		for(const i of Object.keys(this.client.lines) as any as Array<keyof Client['lines']>) {
			const show = this._map.fmFilterFunc(this.client.lines[i]);
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
				routePoints: [ ],
				trackPoints: [ ]
			};

			let handler: ClickListenerHandle;

			const addPoint = (pos: Point) => {
				line.routePoints.push(pos);
				line.trackPoints = [ ...line.routePoints, pos ]; // Add pos a second time so that it gets overwritten by mouseMoveListener
				this._addLine(line);
				handler = addClickListener(this._map, handleClick, handleMouseMove);
			};

			const handleClick = (pos: Point) => {
				if(line.routePoints.length > 0 && pos.lon == line.routePoints[line.routePoints.length-1].lon && pos.lat == line.routePoints[line.routePoints.length-1].lat)
					finishLine(true);
				else
					addPoint(pos);
			}

			const handleMouseMove = (pos: Point) => {
				if(line.trackPoints!.length > 0) {
					line.trackPoints![line.trackPoints!.length-1] = pos;
					this._addLine(line);
				}
			}

			const finishLine = async (save: boolean) => {
				handler.cancel();
				this._deleteLine(line);

				delete this._endDrawLine;

				if(save && line.routePoints.length >= 2)
					resolve(line.routePoints);
				else
					resolve(undefined);
			}

			handler = addClickListener(this._map, handleClick, handleMouseMove)

			this._endDrawLine = finishLine;
		});
	}

	_addLine(line: Line & { trackPoints?: BasicTrackPoints }): void {
		const trackPoints = trackPointsToLatLngArray(line.trackPoints);

		if(trackPoints.length < 2) {
			this._deleteLine(line);
			return;
		}

		if(!this.linesById[line.id]) {
			this.linesById[line.id] = new HighlightablePolyline([ ]);
			this.addLayer(this.linesById[line.id]);

			if(line.id != null) { // We don't want a popup for lines that we are drawing right now
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

		// Two points that are both outside of the viewport should not be connected, as the piece in between
		// has not been received.
		const splitLatLngs = disconnectSegmentsOutsideViewport(trackPoints, this._map.getBounds());

		(this.linesById[line.id] as any).line = line;
		this.linesById[line.id].setLatLngs(splitLatLngs).setStyle(style);
	}

	_deleteLine(line: ObjectWithId): void {
		if(!this.linesById[line.id])
			return;

		this.removeLayer(this.linesById[line.id]);
		delete this.linesById[line.id];
	}

}