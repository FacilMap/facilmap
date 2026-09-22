import type { ID, Point } from "facilmap-types";
import { Icon, Marker as LeafletMarker, setOptions, type LeafletMouseEvent } from "leaflet";
import { type PointLocation } from "locate-on-line";
import type LinesLayer from "./lines-layer";

export default class LinesLayerClick {
	protected expectingClick: {
		lineId: ID;
		touchMode: boolean;
		position?: PointLocation<L.LatLng[][]>;
		dragMarker?: L.Marker;
		cancel: () => void;
		onUpdate?: (point: Point | undefined) => void;
	} | undefined = undefined;

	constructor(protected linesLayer: LinesLayer) {
	}

	dispose(): void {
		this.expectingClick?.cancel();
	}

	handleLineUpdate(lineId: ID): void {
		if (this.expectingClick && this.expectingClick.lineId === lineId) {
			this._handleTrackPointsChange();
		}
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

		const handleClick = !touchMode && (async (e: LeafletMouseEvent) => {
			if (e.propagatedFrom?.line?.id === lineId) {
				await finish(e.latlng);
			}
		});

		const handleMouseMove = !touchMode && ((e: LeafletMouseEvent) => {
			if (e.propagatedFrom?.line?.id === lineId && this.expectingClick) {
				this._setMarkerPos(e.latlng);
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
				if (this.linesLayer["_map"].getBounds().contains(pos)) {
					onUpdate({ lat: pos.lat, lon: pos.lng });
				} else {
					onUpdate(undefined);
				}
			}
		});

		if (handleClick) {
			this.linesLayer.addEventListener("click", handleClick);
		}
		if (handleMouseMove) {
			this.linesLayer.addEventListener("mousemove", handleMouseMove);
		}
		if (handleMouseOut) {
			this.linesLayer.addEventListener("mouseout", handleMouseOut);
		}
		if (handleMoveEnd) {
			this.linesLayer["_map"].addEventListener("moveend", handleMoveEnd);
			this.linesLayer["_map"].addEventListener("zoomend", handleMoveEnd);
		}

		const cancel = () => {
			if (this.expectingClick !== expectingClick) {
				return;
			}

			if (handleClick) {
				this.linesLayer.removeEventListener("click", handleClick);
			}
			if (handleMouseMove) {
				this.linesLayer.removeEventListener("mousemove", handleMouseMove);
			}
			if (handleMouseOut) {
				this.linesLayer.removeEventListener("mouseout", handleMouseOut);
			}
			if (handleMoveEnd) {
				this.linesLayer["_map"].removeEventListener("moveend", handleMoveEnd);
				this.linesLayer["_map"].removeEventListener("zoomend", handleMoveEnd);
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
			lineId: lineId,
			touchMode,
			cancel,
			onUpdate
		};

		this._handleTrackPointsChange();
		if (handleMoveEnd) {
			handleMoveEnd();
		}

		return {
			cancel,
			finish: async () => await finish()
		};
	}

	_handleTrackPointsChange(): void {
		if (this.expectingClick) {
			const lineId = this.expectingClick.lineId;
			const layer = this.linesLayer["linesById"][lineId];

			// Track points appearing for the first time: Add drag marker
			if (layer?._fmLineString && !this.expectingClick.dragMarker) {
				const dragMarker = this.expectingClick.dragMarker = new LeafletMarker([0, 0], {
					interactive: this.expectingClick.touchMode,
					draggable: this.expectingClick.touchMode,
					pane: "fm-raised-marker",
					icon: new Icon({})
				}).on("drag", (e) => {
					this._setMarkerPos((e as any).latlng);
				});

				if (this.expectingClick.touchMode) {
					this._setMarkerPos(this.linesLayer["_map"].getCenter());
					dragMarker.addTo(this.linesLayer["_map"]);

					Object.defineProperty(dragMarker, "_fmLineString", {
						get: () => this.linesLayer["linesById"][lineId]?._fmLineString,
						enumerable: true,
						configurable: true
					});

					this.linesLayer["tooltip"].registerLineTooltip(dragMarker, {
						getLine: () => this.linesLayer["client"].lines[lineId],
						getOptions: () => ({ name: false, details: true }),
						getHoverPos: () => this.expectingClick?.position,
						fixed: true
					});
				}
			}
		}
	}

	_setMarkerPos(pos: L.LatLng): void {
		if (this.expectingClick) {
			const layer = this.linesLayer["linesById"][this.expectingClick.lineId];
			const lineString = layer?._fmLineString;
			const closest = this.expectingClick.position = lineString?.locate(pos);
			if (lineString && closest && this.expectingClick.dragMarker) {
				let idxBefore = Math.floor(closest.idx[1]);
				if (idxBefore >= lineString._fmTrackPoints[closest.idx[0]].length - 1) {
					idxBefore--;
				}
				const pointBefore = lineString._fmTrackPoints[closest.idx[0]][idxBefore];
				const pointAfter = lineString._fmTrackPoints[closest.idx[0]][idxBefore + 1];

				const icon = this._getLineClickIcon(
					this.expectingClick.touchMode,
					this.linesLayer["client"].lines[this.expectingClick.lineId]?.width ?? 0,
					this.linesLayer["_map"].project(pointBefore),
					this.linesLayer["_map"].project(pointAfter)
				);
				// We cannot call dragMarker.setIcon(), since that would abort an ongoing drag operation
				setOptions(this.expectingClick.dragMarker.options.icon, icon.options);
				if (this.expectingClick.dragMarker._icon) {
					(this.expectingClick.dragMarker._icon as HTMLImageElement).src = icon.options.iconUrl;
				}

				this.expectingClick.dragMarker.setLatLng(closest.latlng).addTo(this.linesLayer["_map"]);

				if (this.expectingClick.touchMode) {
					this.linesLayer["tooltip"].updateLineTooltip(this.expectingClick.dragMarker);
				}

				this.expectingClick.onUpdate?.({ lat: closest.latlng.lat, lon: closest.latlng.lng });
			} else {
				this.expectingClick.onUpdate?.(undefined);
			}
		}
	}

	_getLineClickIcon(touchMode: boolean, lineWidth: number, pointBefore: L.Point, pointAfter: L.Point): L.Icon {
		const arrowLength = 50;
		const arrowWidth = 3;
		const circleWidth = 4;
		const arrowHeadLength = 18;
		const arrowHeadWidth = 18;
		const outlineWidth = 1;

		const center = arrowLength + lineWidth / 2 + circleWidth / 2;
		const size = center * 2;

		const dx = pointAfter.x - pointBefore.x;
		const dy = pointAfter.y - pointBefore.y;
		const lineLength = Math.sqrt(dx * dx + dy * dy);
		const nx = -dy / lineLength;
		const ny = dx / lineLength;

		const tipOffset = lineWidth / 2 + arrowHeadLength/2 + outlineWidth;
		const tailOffset = tipOffset + arrowLength - arrowHeadLength/2 - outlineWidth;

		const arrow1 = {
			x1: center + tailOffset * nx,
			y1: center + tailOffset * ny,
			x2: center + tipOffset * nx,
			y2: center + tipOffset * ny
		};

		const arrow2 = {
			x1: center - tailOffset * nx,
			y1: center - tailOffset * ny,
			x2: center - tipOffset * nx,
			y2: center - tipOffset * ny
		};

		const svg = (
			`<?xml version="1.0" encoding="UTF-8" standalone="no"?>` +
			`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 ${size} ${size}">` +
				`<defs>` +
					`<marker id="arrow" refX="${(arrowHeadLength + 2 * outlineWidth) / 2}" refY="${(arrowHeadWidth + 2 * outlineWidth) / 2}" markerWidth="${arrowHeadLength + 2 * outlineWidth}" markerHeight="${arrowHeadWidth + 2 * outlineWidth}" orient="auto-start-reverse" markerUnits="userSpaceOnUse">` +
						`<path d="M ${outlineWidth/2} ${outlineWidth/2} L ${arrowHeadLength + 1.5*outlineWidth} ${arrowHeadWidth/2 + outlineWidth} L ${outlineWidth/2} ${arrowHeadWidth + 1.5*outlineWidth} z" fill="#000" stroke="#fff" stroke-width="${outlineWidth}" />` +
					`</marker>` +
				`</defs>` +
				(touchMode ? (
					`<circle cx="${center}" cy="${center}" r="${tailOffset}" stroke="#fff" stroke-width="${circleWidth}" fill="rgba(255, 255, 255, 0.3)" />` +
					`<circle cx="${center}" cy="${center}" r="${tailOffset}" stroke="#000" stroke-width="${circleWidth - 2 * outlineWidth}" fill="none" />`
				) : "") +
				`<line x1="${arrow1.x1}" y1="${arrow1.y1}" x2="${arrow1.x2}" y2="${arrow1.y2}" stroke="#fff" stroke-width="${arrowWidth + 2 * outlineWidth}" marker-end="url(#arrow)" />` +
				`<line x1="${arrow1.x1}" y1="${arrow1.y1}" x2="${arrow1.x2}" y2="${arrow1.y2}" stroke="#000" stroke-width="${arrowWidth}" />` +
				`<line x1="${arrow2.x1}" y1="${arrow2.y1}" x2="${arrow2.x2}" y2="${arrow2.y2}" stroke="#fff" stroke-width="${arrowWidth + 2 * outlineWidth}" marker-end="url(#arrow)" />` +
				`<line x1="${arrow2.x1}" y1="${arrow2.y1}" x2="${arrow2.x2}" y2="${arrow2.y2}" stroke="#000" stroke-width="${arrowWidth}" />` +
			`</svg>`
		);

		return new Icon({
			iconUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
			iconSize: [size, size],
			tooltipAnchor: [size/2, 0]
		});
	}
}