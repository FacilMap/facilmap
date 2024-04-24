import type { ID, MapId } from "./base.js";
import type { Marker } from "./marker.js";
import type { Line } from "./line.js";
import type { View } from "./view.js";
import type { MapData } from "./mapData.js";
import type { Type } from "./type.js";

export type HistoryEntryAction = "create" | "update" | "delete";

export type HistoryEntryObjectTypes = {
	"Marker": Omit<Marker, "id">;
	"Line": Omit<Line, "id">;
	"View": Omit<View, "id">;
	"Type": Omit<Type, "id">;
	"Map": MapData;
};

export type HistoryEntryType = keyof HistoryEntryObjectTypes;
export type HistoryEntryObject<T extends HistoryEntryType> = HistoryEntryObjectTypes[T];

export type GenericHistoryEntry<ObjectTypes extends Record<HistoryEntryType, any>> = {
	[Type in HistoryEntryType]: {
		[Action in HistoryEntryAction]: {
			id: ID;
			time: string;
			type: Type;
			action: Action;
			mapId: MapId;
		} & (Action extends "create" ? {
			objectBefore?: undefined;
		} : {
			objectBefore: ObjectTypes[Type];
		}) & (Action extends "delete" ? {
			objectAfter?: undefined;
		} : {
			objectAfter: ObjectTypes[Type];
		}) & (Type extends "Map" ? {
			objectId?: undefined;
		} : {
			objectId: ID;
		});
	}[HistoryEntryAction]
}[HistoryEntryType];

export type HistoryEntry = GenericHistoryEntry<HistoryEntryObjectTypes>;

export type HistoryEntryCreate = Omit<HistoryEntry, "id" | "time" | "mapId">;