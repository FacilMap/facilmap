import "./legend.scss";
import Client from "facilmap-client";
import { ID, Shape, Symbol, Type } from "facilmap-types";
import { symbolList } from "facilmap-leaflet";
import { getBrightness } from "facilmap-utils";
import { MapContext } from "../leaflet-map/leaflet-map";

export interface LegendType {
	type: Type['type'];
	typeId: ID;
	name: string;
	items: LegendItem[];
	filtered: boolean;
	defaultColour?: string;
	defaultShape?: Shape;
}

export interface LegendItem {
	value: string;
	label?: string;
	field?: string;
	filtered?: boolean;
	first?: boolean;
	strikethrough?: boolean;
	colour?: string;
	symbol?: Symbol;
	shape?: Shape;
	width?: number;
	bright?: boolean;
}

export function getLegendItems(client: Client, mapContext: MapContext): LegendType[] {
	const legendItems: LegendType[] = [ ];
	for (const i in client.types) {
		const type = client.types[i];

		if(!type.showInLegend)
			continue;

		const items: LegendItem[] = [ ];
		const fields: Record<string, string[]> = { };

		if (type.colourFixed || (type.type == "marker" && type.symbolFixed && type.defaultSymbol && (symbolList.includes(type.defaultSymbol) || type.defaultSymbol.length == 1)) || (type.type == "marker" && type.shapeFixed) || (type.type == "line" && type.widthFixed)) {
			const item: LegendItem = { value: type.name, label: type.name, filtered: true };

			if(type.colourFixed)
				item.colour = type.defaultColour ? `#${type.defaultColour}` : undefined;
			if(type.type == "marker" && type.symbolFixed && type.defaultSymbol && (symbolList.includes(type.defaultSymbol) || type.defaultSymbol.length == 1))
				item.symbol = type.defaultSymbol;
			if(type.type == "marker" && type.shapeFixed)
				item.shape = type.defaultShape ?? undefined;
			if(type.type == "line" && type.widthFixed)
				item.width = type.defaultWidth ?? undefined;
				
			if (item.colour)
				item.bright = getBrightness(item.colour) > 0.7;

			items.push(item);
		}

		for (const field of type.fields) {
			if ((field.type != "dropdown" && field.type != "checkbox") || (!field.controlColour && (type.type != "marker" || !field.controlSymbol) && (type.type != "marker" || !field.controlShape) && (type.type != "line" || !field.controlWidth)))
				continue;

			fields[field.name] = [ ];

			(field.options || [ ]).forEach((option, idx) => {
				const item: LegendItem = { value: option.value, label: option.value, field: field.name, filtered: true, first: idx == 0 };

				if(field.type == "checkbox") {
					item.value = idx == 0 ? "0" : "1";

					if(!item.label || /* Legacy format */ item.label == '0' || item.label == '1') {
						item.label = field.name;
						if(idx == 0)
							item.strikethrough = true;
					}
				}

				if(field.controlColour)
					item.colour = `#${option.colour}`;
				if(type.type == "marker" && field.controlSymbol)
					item.symbol = option.symbol;
				if(type.type == "marker" && field.controlShape)
					item.shape = option.shape;
				if(type.type == "line" && field.controlWidth)
					item.width = option.width;

				if (item.colour)
					item.bright = getBrightness(item.colour) > 0.7;

				items.push(item);
				fields[field.name].push(item.value);
			});
		}

		if(items.length == 0) {
			const item: LegendItem = {
				value: type.name,
				label: type.name,
				filtered: true
			};

			if(type.type == "marker")
				item.shape = "drop";

			items.push(item);
		}

		const legendType: LegendType = { type: type.type, typeId: type.id, name: type.name, items: items, filtered: true, defaultColour: type.defaultColour ?? undefined, defaultShape: type.defaultShape ?? undefined };

		// Check which fields are filtered
		allCombinations(fields, (data) => {
			if(mapContext.filterFunc({ typeId: legendType.typeId, data: data })) {
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

	rec(0, { });
}