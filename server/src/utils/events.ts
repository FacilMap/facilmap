import { EventEmitter } from "events";
import type { EventHandler, EventName } from "facilmap-types";

interface AddListener<EventTypes extends Record<string, any[]>, This> {
	<E extends EventName<EventTypes>>(event: E, listener: EventHandler<EventTypes, E>): This;
}

export class TypedEventEmitter<EventTypes extends Record<string, any[]>> extends EventEmitter {

	declare addListener: AddListener<EventTypes, this>;
	declare on: AddListener<EventTypes, this>;
	declare once: AddListener<EventTypes, this>;
	declare prependListener: AddListener<EventTypes, this>;
	declare prependOnceListener: AddListener<EventTypes, this>;
	declare removeListener: AddListener<EventTypes, this>;
	declare off: AddListener<EventTypes, this>;
	declare removeAllListeners: (event?: EventName<EventTypes>) => this;
	declare listeners: (event: EventName<EventTypes>) => Function[];
	declare rawListeners: (event: EventName<EventTypes>) => Function[];
	declare emit: <E extends EventName<EventTypes>>(event: E, ...args: EventTypes[E]) => boolean;
	declare eventNames: () => Array<EventName<EventTypes>>;
	declare listenerCount: (type: EventName<EventTypes>) => number;

}
