import { socketV2RequestValidators, type MapEventsV2, type SocketApiV2 } from "./socket-v2";

// Socket v1:
// - Marker name, line name and map name is never an empty string but defaults to "Untitled marker", "Untitled line" and "Unnamed map"

export const socketV1RequestValidators = socketV2RequestValidators;
export type SocketApiV1<Validated extends boolean> = SocketApiV2<Validated>;
export type MapEventsV1 = MapEventsV2;
