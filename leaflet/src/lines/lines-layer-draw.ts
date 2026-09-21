import type LinesLayer from "./lines-layer";
import type { Line, LineTemplate, Point } from "facilmap-types";
import { type BasicTrackPoints } from "../utils/leaflet";
import { addClickListener, type ClickListenerHandle } from "../click-listener/click-listener";

export default class LinesLayerDraw {

	constructor(protected linesLayer: LinesLayer) {
	}

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
				this.linesLayer["_addLine"](line);
				handler = addClickListener(this.linesLayer["_map"], handleClick, handleMouseMove);

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
					this.linesLayer["_addLine"](line);
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

				this.linesLayer["_deleteLine"](line);

				delete this._endDrawLine;

				if(save && routePoints.length >= 2)
					resolve(routePoints);
				else
					resolve(undefined);
			};

			document.addEventListener("keydown", handleKeyDown);
			handler = addClickListener(this.linesLayer["_map"], handleClick, handleMouseMove);

			this._endDrawLine = finishLine;
		});
	}

	endDrawLine(save = false): void {
		if (!this._endDrawLine)
			throw new Error("No drawing in process.");
		else
			this._endDrawLine(save);
	}

	protected _endDrawLine?: (save: boolean) => void;

}