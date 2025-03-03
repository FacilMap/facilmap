import type { ID, Shape, Stroke, Icon, Type } from "facilmap-types";
import { iconList } from "facilmap-leaflet";
import { formatTypeName, getDefaultFieldShowInLegend, getOrderedTypes, isBright } from "facilmap-utils";
import type { FacilMapContext } from "../facil-map-context-provider/facil-map-context";
import { requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";

export interface LegendType {
	key: string;
	type: Type['type'];
	typeId: ID;
	name: string;
	items: LegendItem[];
	filtered: boolean;
}

export interface LegendItem {
	key: string;
	value: string;
	label?: string;
	field?: string;
	filtered?: boolean;
	first?: boolean;
	strikethrough?: boolean;
	colour?: string;
	icon?: Icon;
	shape?: Shape;
	width?: number;
	stroke?: Stroke;
	bright?: boolean;
}

export function getLegendItems(context: FacilMapContext): LegendType[] {
	const client = requireClientContext(context).value;
	const mapContext = requireMapContext(context).value;

	const legendItems: LegendType[] = [ ];
	for (const type of getOrderedTypes(client.types)) {
		if(!type.showInLegend)
			continue;

		const items: LegendItem[] = [ ];
		const fields: Record<string, string[]> = Object.create(null);

		if (
			type.colourFixed ||
			(type.type == "marker" && type.iconFixed && type.defaultIcon && (iconList.includes(type.defaultIcon) || type.defaultIcon.length == 1)) ||
			(type.type == "marker" && type.shapeFixed) ||
			(type.type == "line" && type.widthFixed) ||
			(type.type === "line" && type.strokeFixed)
		) {
			const item: LegendItem = {
				key: `legend-item-${type.id}`,
				value: type.name,
				label: formatTypeName(type.name),
				filtered: true
			};

			if (type.colourFixed) {
				item.colour = type.defaultColour ? `#${type.defaultColour}` : undefined;
			}
			if (type.type == "marker" && type.iconFixed && type.defaultIcon && (iconList.includes(type.defaultIcon) || type.defaultIcon.length == 1)) {
				item.icon = type.defaultIcon;
			}
			if (type.type == "marker" && type.shapeFixed) {
				item.shape = type.defaultShape ?? "";
			}
			if (type.type == "line" && type.widthFixed) {
				item.width = type.defaultWidth ?? undefined;
			}
			if (type.type === "line" && type.strokeFixed) {
				item.stroke = type.defaultStroke;
			}

			if (item.colour)
				item.bright = isBright(item.colour);

			items.push(item);
		}

		for (const field of type.fields) {
			if (
				(field.type != "dropdown" && field.type != "checkbox") ||
				!(field.showInLegend ?? getDefaultFieldShowInLegend(type, field))
			)
				continue;

			fields[field.name] = [ ];

			(field.options || [ ]).forEach((option, idx) => {
				const item: LegendItem = {
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

		if(items.length == 0) {
			const item: LegendItem = {
				key: `legend-item-${type.id}`,
				value: type.name,
				label: formatTypeName(type.name),
				filtered: true
			};

			if(type.type == "marker")
				item.shape = "drop";

			items.push(item);
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