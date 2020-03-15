import { ID } from "./base";
import { Marker } from "./marker";
import { Line } from "./line";
import { View } from "./view";
import { PadData } from "./padData";
import { Type } from "./type";

type HistoryEntryType = "Marker" | "Line" | "View" | "Type" | "Pad";
type HistoryEntryAction = "create" | "update" | "delete";

type HistoryEntryObject<T extends HistoryEntryType> =
	T extends "Marker" ? Marker :
		T extends "Line" ? Line :
			T extends "View" ? View :
				T extends "Type" ? Type :
					PadData;

type HistoryEntryBefore<T extends HistoryEntryType, A extends HistoryEntryAction> = A extends "create" ? null : HistoryEntryObject<T>;
type HistoryEntryAfter<T extends HistoryEntryType, A extends HistoryEntryAction> = A extends "delete" ? null : HistoryEntryObject<T>;

interface HistoryEntryBase<T extends HistoryEntryType, A extends HistoryEntryAction> {
	id: ID;
	time: Date;
	objectId: ID;
	action: A;
	objectBefore: HistoryEntryBefore<T, A>;
	objectAfter: HistoryEntryAfter<T, A>;
}

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
