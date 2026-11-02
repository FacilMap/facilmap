import type { ID, Shape, Stroke, Icon, Type } from "facilmap-types";
import { iconList } from "facilmap-leaflet";
import { countBy, uniq } from "lodash-es";
import { bounds, LineUtil, point, type LatLngBounds } from "leaflet";
import type { LineWithTrackPoints } from "facilmap-client";
import { formatTypeName, getDefaultFieldShowInLegend, getOrderedTypes, isBright } from "facilmap-utils";
import type { FacilMapContext } from "../facil-map-context-provider/facil-map-context";
import { requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";

export interface LegendType {
	key: string;
	type: Type['type'];
	typeId: ID;
	name: string;
	items: LegendMapItem[];
	filtered: boolean;
}

export interface LegendItem {
	key: string;
	label?: string;
	description?: string;
	field?: string;
	filtered?: boolean;
	first?: boolean;
	main?: boolean;
	strikethrough?: boolean;
	colour?: string;
	icon?: Icon;
	shape?: Shape;
	width?: number;
	stroke?: Stroke;
	arrowRight?: boolean;
	border?: boolean;
	bright?: boolean;
}

export interface LegendMapItem extends LegendItem {
	value: string;
}

/**
 * Whether the line as drawn on the map crosses the given bounds. Like in the lines layer, routed lines are drawn from
 * their loaded track points and straight lines from their route points.
 */
function isLineInBounds(line: LineWithTrackPoints, latLngBounds: LatLngBounds): boolean {
	const rect = bounds([latLngBounds.getWest(), latLngBounds.getSouth()], [latLngBounds.getEast(), latLngBounds.getNorth()]);
	const linePoints = line.mode ? Object.values(line.trackPoints).filter((p) => typeof p === "object") : line.routePoints;
	const points = linePoints.map((p) => point(p.lon, p.lat));
	return points.some((p, i) => rect.contains(p) || (i > 0 && LineUtil.clipSegment(points[i - 1], p, rect) !== false));
}

export function getLegendItems(context: FacilMapContext): LegendType[] {
	const client = requireClientContext(context).value;
	const mapContext = requireMapContext(context).value;

	const legendItems: LegendType[] = [ ];
	for (const type of getOrderedTypes(client.types)) {
		if(!type.showInLegend)
			continue;

		const items: LegendMapItem[] = [ ];
		const fields: Record<string, string[]> = Object.create(null);

		const mainItem: LegendMapItem = {
			key: `legend-item-${type.id}`,
			value: type.name,
			label: formatTypeName(type.name),
			main: true,
			filtered: true
		};

		// The objects of this type in the current map view, for showing the colours and shapes in use if they are not fixed
		const visibleMarkers = type.type === "marker" ? Object.values(client.markers).filter((m) => (
			m.typeId === type.id && mapContext.bounds.contains([m.lat, m.lon])
		)) : [];
		const visibleLines = type.type === "line" ? Object.values(client.lines).filter((l) => (
			l.typeId === type.id && isLineInBounds(l, mapContext.bounds)
		)) : [];

		if (type.colourFixed) {
			mainItem.colour = type.defaultColour ? `#${type.defaultColour}` : undefined;
		} else {
			// Blend the colours in use by how often they are used, most used first. If nothing is visible, the rainbow is shown.
			const counts = Object.entries(countBy([...visibleMarkers, ...visibleLines], (o) => `#${o.colour}`)).sort((a, b) => b[1] - a[1]);
			mainItem.colour = counts.length > 1 ? counts.map(([c, count]) => `${c} ${count}`).join(",") : counts[0]?.[0];
		}
		if (type.type == "marker") {
			// If the icon is not fixed, show the icon in use if all visible markers have the same one
			const icons = uniq(visibleMarkers.map((m) => m.icon));
			const icon = type.iconFixed ? type.defaultIcon : icons.length === 1 ? icons[0] : undefined;
			if (icon && (iconList.includes(icon) || icon.length == 1)) {
				mainItem.icon = icon;
			}
		}
		if (type.type == "marker") {
			if (type.shapeFixed) {
				mainItem.shape = type.defaultShape ?? "";
			} else {
				// Show the shape in use if all visible markers have the same one
				const shapes = uniq(visibleMarkers.map((m) => m.shape));
				mainItem.shape = shapes.length === 1 ? shapes[0] : "drop";
			}
		}
		if (type.type == "line" && type.widthFixed) {
			mainItem.width = type.defaultWidth ?? undefined;
		}
		if (type.type === "line" && type.strokeFixed) {
			mainItem.stroke = type.defaultStroke;
		}

		if (mainItem.colour)
			mainItem.bright = isBright(mainItem.colour);

		items.push(mainItem);

		for (const field of type.fields) {
			if (
				(field.type != "dropdown" && field.type != "checkbox") ||
				!(field.showInLegend ?? getDefaultFieldShowInLegend(type, field))
			)
				continue;

			fields[field.name] = [ ];

			(field.options || [ ]).forEach((option, idx) => {
				const item: LegendMapItem = {
					key: `legend-item-${type.id}-${field.name}-${option.value}`,
					value: option.value,
					label: option.value,
					field: field.name,
					filtered: true,
					first: idx == 0
				};

				if(field.type == "checkbox") {
					item.value = idx == 0 ? "0" : "1";

					if(!item.label || /* Legacy format */ item.label == '0' || item.label == '1') {
						item.label = field.name;
						if(idx == 0)
							item.strikethrough = true;
					}
				}

				if (field.controlColour) {
					item.colour = `#${option.colour ?? type.defaultColour}`;
				} else if (type.colourFixed) {
					item.colour = `#${type.defaultColour}`;
				}

				if (type.type == "marker") {
					if (field.controlIcon) {
						item.icon = option.icon ?? type.defaultIcon;
					} else if (type.iconFixed) {
						item.icon = type.defaultIcon;
					}

					if (field.controlShape) {
						item.shape = option.shape ?? type.defaultShape;
					} else if (type.shapeFixed) {
						item.shape = type.defaultShape;
					}
				} else if (type.type == "line") {
					if (field.controlWidth) {
						item.width = option.width ?? type.defaultWidth;
					} else if (type.widthFixed) {
						item.width = type.defaultWidth;
					}

					if (field.controlStroke) {
						item.stroke = option.stroke ?? type.defaultStroke;
					} else if (type.strokeFixed) {
						item.stroke = type.defaultStroke;
					}
				}

				if (item.colour) {
					item.bright = isBright(item.colour);
				}

				items.push(item);
				fields[field.name].push(item.value);
			});
		}

		const legendType: LegendType = {
			key: `legend-type-${type.id}`,
			type: type.type,
			typeId: type.id,
			name: formatTypeName(type.name),
			items,
			filtered: true,
		};

		// Check which fields are filtered
		allCombinations(fields, (data) => {
			if(mapContext.filterFunc({ typeId: legendType.typeId, data } as any, type)) {
				legendType.filtered = false;

				for (const item of items) {
					if (!item.field)
						item.filtered = false;
				}

				for(const i in data) {
					items.forEach(function(it) {
						if(it.field == i && it.value == data[i])
							it.filtered = false;
					});
				}
			}
		});

		legendItems.push(legendType);
	}

	return legendItems;
}

function allCombinations(fields: Record<string, string[]>, callback: (data: Record<string, string>) => void): void {
	const fieldKeys = Object.keys(fields);

	function rec(i: number, vals: Record<string, string>) {
		if(i == fieldKeys.length)
			return callback(vals);

		for (const f of fields[fieldKeys[i]]) {
			vals[fieldKeys[i]] = f;
			rec(i+1, vals);
		}
	}

	rec(0, Object.create(null));
}