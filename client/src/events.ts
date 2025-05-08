import type { EventHandler, EventName } from "facilmap-types";

export class EventEmitter<Events extends Record<string, any[]>> {
	private listeners: {
		[E in EventName<Events>]?: Array<EventHandler<Events, E>>
	} = { };

	on<E extends EventName<Events>>(eventName: E, fn: EventHandler<Events, E>): void {
		this.listeners[eventName] = [...(this.listeners[eventName] || [] as any), fn];
	}

	once<E extends EventName<Events>>(eventName: E, fn: EventHandler<Events, E>): void {
		const handler = ((...data: any[]) => {
			this.removeListener(eventName, handler);
			(fn as any)(...data);
		}) as EventHandler<Events, E>;
		this.on(eventName, handler);
	}

	removeListener<E extends EventName<Events>>(eventName: E, fn: EventHandler<Events, E>): void {
		const listeners = this.listeners[eventName] as Array<EventHandler<Events, E>> | undefined;
		if(listeners) {
			this.listeners[eventName] = listeners.filter((listener) => (listener !== fn)) as any;
		}
	}

	protected _emit<E extends EventName<Events>>(eventName: E, ...data: Events[E]): void {
		const listeners = this.listeners[eventName] as Array<EventHandler<Events, E>> | undefined;
		if(listeners) {
			listeners.forEach(function(listener: EventHandler<Events, E>) {
				listener(...data);
			});
		}
	}
}