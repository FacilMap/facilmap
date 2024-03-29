export type EventName<Events extends Record<keyof Events, any[]>> = keyof Events & string;

export type EventHandler<Events extends Record<keyof Events, any[]>, E extends EventName<Events>> = (...args: Events[E]) => void;

export type MultipleEvents<Events extends Record<keyof Events, any[]>> = {
	[E in EventName<Events>]?: Array<Events[E][0]>;
};