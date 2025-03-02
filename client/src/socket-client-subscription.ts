import type { DeepReadonly, EventHandler, EventName } from "facilmap-types";
import { type ClientEvents, type SocketClient } from "./socket-client";
import { DefaultReactiveObjectProvider, _defineDynamicGetters, type ReactiveObjectProvider } from "./reactivity";

export enum SubscriptionStateType {
	/** The client has subscribed and is currently receiving the events with the subscription data. */
	SUBSCRIBING = "subscribing",
	/** The client has subscribed and has received the events with the subscription data. */
	SUBSCRIBED = "subscribed",
	/** The subscription was explicitly canceled. */
	UNSUBSCRIBED = "unsubscribed",
	/** The socket connection has been lost and is currently trying to reconnect. */
	DISCONNECTED = "disconnected",
	/** The socket connection has been lost and has given up trying to reconnect. */
	FATAL_ERROR = "fatal_error"
};

export type SubscriptionState = (
	| { type: SubscriptionStateType.SUBSCRIBING | SubscriptionStateType.SUBSCRIBED | SubscriptionStateType.UNSUBSCRIBED | SubscriptionStateType.DISCONNECTED }
	| { type: SubscriptionStateType.FATAL_ERROR; error: Error }
);

export type BasicSubscriptionData = {
	state: DeepReadonly<SubscriptionState>;
};

export abstract class SocketClientSubscription<Data extends { state: any }> {
	client: SocketClient;
	protected reactiveObjectProvider: ReactiveObjectProvider;
	subscribePromise: Promise<this>;
	protected data: Data;

	constructor(client: SocketClient, data: Omit<Data, "state"> & {
		reactiveObjectProvider?: ReactiveObjectProvider;
	}) {
		this.client = client;
		const { reactiveObjectProvider, ...otherData } = data;
		this.reactiveObjectProvider = reactiveObjectProvider ?? new DefaultReactiveObjectProvider();

		this.data = this.reactiveObjectProvider.makeReactive({
			...otherData,
			state: { type: SubscriptionStateType.SUBSCRIBING }
		}) as Data;

		for(const [i, handler] of Object.entries(this._getEventHandlers())) {
			client.on(i as any, handler as any);
		}

		this.subscribePromise = this._subscribe().then(() => this);

		_defineDynamicGetters(this, this.data, this.reactiveObjectProvider);
	}

	protected async _subscribe(): Promise<void> {
		this.reactiveObjectProvider.set(this.data as BasicSubscriptionData, "state", { type: SubscriptionStateType.SUBSCRIBING });
		await this._doSubscribe();
		this.reactiveObjectProvider.set(this.data as BasicSubscriptionData, "state", { type: SubscriptionStateType.SUBSCRIBED });
	}

	protected abstract _doSubscribe(): Promise<void>;

	async unsubscribe(): Promise<void> {
		this.reactiveObjectProvider.set(this.data as BasicSubscriptionData, "state", { type: SubscriptionStateType.UNSUBSCRIBED });
		await this._doUnsubscribe();
	}

	protected abstract _doUnsubscribe(): Promise<void>;

	protected _getEventHandlers(): {
		[E in EventName<ClientEvents>]?: EventHandler<ClientEvents, E>
	} {
		return {
			disconnect: () => {
				this.reactiveObjectProvider.set(this.data as BasicSubscriptionData, "state", {
					type: SubscriptionStateType.DISCONNECTED
				});
			},

			connect: () => {
				this.reactiveObjectProvider.set(this.data as BasicSubscriptionData, "state", {
					type: SubscriptionStateType.SUBSCRIBING
				});

				this._subscribe().catch((err) => {
					console.error("Error subscribing after reconnection", err);
				});
			}
		};
	};

}