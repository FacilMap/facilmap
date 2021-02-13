import Socket, { TrackPoints } from "facilmap-client";
import { ID, Line, LinePointsEvent, ObjectWithId } from "facilmap-types";
import { FeatureGroup, LayerOptions, Map, PolylineOptions } from "leaflet";
import { HighlightableLayerOptions, HighlightablePolyline } from "leaflet-highlightable-layers";
import { disconnectSegmentsOutsideViewport, tooltipOptions, trackPointsToLatLngArray } from "../utils/leaflet";
import { quoteHtml } from "../utils/utils";

interface LinesLayerOptions extends LayerOptions {
}

export default class LinesLayer extends FeatureGroup {

	options!: LayerOptions;
	client: Socket;
	linesById: Record<string, InstanceType<typeof HighlightablePolyline>> = {};
	highlightedLinesIds = new Set<ID>();

	constructor(client: Socket, options?: LinesLayerOptions) {
		super([], options);
		this.client = client;
	}

	onAdd(map: Map) {
		super.onAdd(map);

		this.client.on("line", this.handleLine);
		this.client.on("linePoints", this.handleLinePoints);
		this.client.on("deleteLine", this.handleDeleteLine);

		map.on("fmFilter", this.handleFilter);

		return this;
	}

	onRemove(map: Map) {
		super.onRemove(map);

		this.client.removeListener("line", this.handleLine);
		this.client.removeListener("linePoints", this.handleLinePoints);
		this.client.removeListener("deleteLine", this.handleDeleteLine);

		map.off("fmFilter", this.handleFilter);

		return this;
	}

	handleLine = (line: Line) => {
		if(this._map.fmFilterFunc(line))
			this._addLine(line);
	};

	handleLinePoints = (event: LinePointsEvent) => {
		const line = this.client.lines[event.id];
		if(line && this._map.fmFilterFunc(line))
			this._addLine(line);
	};

	handleDeleteLine = (data: ObjectWithId) => {
		this._deleteLine(data);
	};

	handleFilter = () => {
		for(const i of Object.keys(this.client.lines) as any as Array<keyof Socket['lines']>) {
			const show = this._map.fmFilterFunc(this.client.lines[i]);
			if(this.linesById[i] && !show)
				this._deleteLine(this.client.lines[i]);
			else if(!this.linesById[i] && show)
				this._addLine(this.client.lines[i]);
		}
	};

	highlightLine(id: ID) {
		this.highlightedLinesIds.add(id);
		if (this.client.lines[id])
			this.handleLine(this.client.lines[id]);
	}

	unhighlightLine(id: ID) {
		this.highlightedLinesIds.delete(id);
		if (this.client.lines[id])
			this.handleLine(this.client.lines[id]);
	}

	setHighlightedLines(ids: Set<ID>) {
		for (const id of this.highlightedLinesIds) {
			if (!ids.has(id))
				this.unhighlightLine(id);
		}

		for (const id of ids) {
			if (!this.highlightedLinesIds.has(id))
				this.highlightLine(id);
		}
	}

	_addLine(line: Line & { trackPoints?: TrackPoints }) {
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
		let splitLatLngs = disconnectSegmentsOutsideViewport(trackPoints, this._map.getBounds());

		(this.linesById[line.id] as any).line = line;
		this.linesById[line.id].setLatLngs(splitLatLngs).setStyle(style);
	}

	_deleteLine(line: ObjectWithId) {
		if(!this.linesById[line.id])
			return;

		this.removeLayer(this.linesById[line.id]);
		delete this.linesById[line.id];
	}

}