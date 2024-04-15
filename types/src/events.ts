export type EventName<Events extends Record<string, any[]>> = keyof Events & string;

export type EventHandler<Events extends Record<string, any[]>, E extends EventName<Events>> = (...args: Events[E]) => void;

export type MultipleEvents<Events extends Record<string, any[]>> = {
	[E in EventName<Events>]?: Array<Events[E][0]>;
};