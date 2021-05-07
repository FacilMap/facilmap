import { EventEmitter } from "events";
import { EventHandler, EventName } from "facilmap-types";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */

interface AddListener<EventTypes extends Record<keyof EventTypes, any[]>, This> {
	<E extends EventName<EventTypes>>(event: E, listener: EventHandler<EventTypes, E>): This;
}

export class TypedEventEmitter<EventTypes extends Record<keyof EventTypes, any[]>> extends EventEmitter {

	addListener!: AddListener<EventTypes, this>;
	on!: AddListener<EventTypes, this>;
	once!: AddListener<EventTypes, this>;
	prependListener!: AddListener<EventTypes, this>;
	prependOnceListener!: AddListener<EventTypes, this>;
	removeListener!: AddListener<EventTypes, this>;
	off!: AddListener<EventTypes, this>;
	removeAllListeners!: (event?: EventName<EventTypes>) => this;
	listeners!: (event: EventName<EventTypes>) => Function[];
	rawListeners!: (event: EventName<EventTypes>) => Function[];
	emit!: <E extends EventName<EventTypes>>(event: E, ...args: EventTypes[E]) => boolean;
	eventNames!: () => Array<EventName<EventTypes>>;
	listenerCount!: (type: EventName<EventTypes>) => number;

}
