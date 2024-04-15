import { requestDataValidatorsV2, type MapEventsV2, type ResponseDataMapV2 } from "./socket-v2";

// Socket v1:
// - Marker name, line name and pad name is never an empty string but defaults to "Untitled marker", "Untitled line" and "Unnamed map"

export const requestDataValidatorsV1 = requestDataValidatorsV2;
export type ResponseDataMapV1 = ResponseDataMapV2;
export type MapEventsV1 = MapEventsV2;
