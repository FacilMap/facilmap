import { ID, PadId } from "./base.js";
import { Marker } from "./marker.js";
import { Line } from "./line.js";
import { View } from "./view.js";
import { PadData } from "./padData.js";
import { Type } from "./type.js";

export type HistoryEntryType = "Marker" | "Line" | "View" | "Type" | "Pad";
export type HistoryEntryAction = "create" | "update" | "delete";

export type HistoryEntryObject<T extends HistoryEntryType> =
	T extends "Marker" ? Omit<Marker, 'id'> :
		T extends "Line" ? Omit<Line, 'id'> :
			T extends "View" ? Omit<View, 'id'> :
				T extends "Type" ? Omit<Type, 'id'> :
					PadData;

type HistoryEntryBase<T extends HistoryEntryType, A extends HistoryEntryAction> = {
	id: ID;
	time: string;
	type: T;
	action: A;
	padId: PadId;
} & (A extends "create" ? {
	objectBefore?: undefined;
} : {
	objectBefore: HistoryEntryObject<T>;
}) & (A extends "delete" ? {
	objectAfter?: undefined;
} : {
	objectAfter: HistoryEntryObject<T>;
}) & (T extends "Pad" ? {
	objectId?: undefined;
} : {
	objectId: ID;
});

type HistoryEntryBase2<T extends HistoryEntryType> =
	HistoryEntryBase<T, "create">
	| HistoryEntryBase<T, "update">
	| HistoryEntryBase<T, "delete">


export type HistoryEntry =
	HistoryEntryBase2<"Marker">
	| HistoryEntryBase2<"Line">
	| HistoryEntryBase2<"View">
	| HistoryEntryBase2<"Type">
	| HistoryEntryBase2<"Pad">;

export type HistoryEntryCreate = Omit<HistoryEntry, "id" | "time" | "padId">;