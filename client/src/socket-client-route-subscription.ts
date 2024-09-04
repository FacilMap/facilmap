import type { ApiV3, DeepReadonly, EventHandler, EventName, ExportFormat, Route, SocketApi, SocketVersion, SubscribeToRouteOptions, TrackPoint, TrackPoints } from "facilmap-types";
import { type ClientEvents, type SocketClient } from "./socket-client";
import { type ReactiveObjectProvider } from "./reactivity";
import { mergeEventHandlers, mergeTrackPoints } from "./utils";
import { SocketClientSubscription, type BasicSubscriptionData } from "./socket-client-subscription";

type SocketClientRouteSubscriptionInterface = {
	[K in (
		| "exportRoute"
	)]: SocketApi<SocketVersion.V3, false>[K] extends (routeKey: string, ...args: infer Args) => infer Result ? (...args: Args) => Result : never;
};

export type RouteWithTrackPoints = Omit<Route, "trackPoints"> & { trackPoints: TrackPoints };

export interface RouteSubscriptionData extends BasicSubscriptionData {
	readonly routeKey: string;
	options: DeepReadonly<SubscribeToRouteOptions>;
	route: DeepReadonly<RouteWithTrackPoints> | undefined;
};

export interface SocketClientRouteSubscription extends Readonly<RouteSubscriptionData> {
	// Getters are defined in SocketClientSubscription
}

export class SocketClientRouteSubscription extends SocketClientSubscription<RouteSubscriptionData> implements SocketClientRouteSubscriptionInterface, Omit<Promise<SocketClientRouteSubscription>, typeof Symbol.toStringTag> {
	constructor(client: SocketClient, routeKey: string, options: DeepReadonly<SubscribeToRouteOptions & {
		reactiveObjectProvider?: ReactiveObjectProvider;
	}>) {
		const { reactiveObjectProvider, ...routeOptions } = options;
		super(client, {
			reactiveObjectProvider,
			routeKey,
			options: routeOptions,
			route: undefined
		});
	}

	protected override async _doSubscribe(): Promise<void> {
		await this.client._subscribeToRoute(this.data.routeKey, this.data.options);
	}

	async updateSubscription(options: SubscribeToRouteOptions): Promise<void> {
		this.reactiveObjectProvider.set(this.data, "options", options);
		await this._subscribe();
	}

	protected override async _doUnsubscribe(): Promise<void> {
		await this.client._unsubscribeFromRoute(this.data.routeKey);
	}

	storeRoute(route: Route): void {
		this.reactiveObjectProvider.set(this.data, "route", {
			...route,
			trackPoints: this.data.route?.trackPoints || { length: 0 }
		});
	}

	storeRoutePoints(trackPoints: TrackPoint[], reset: boolean): void {
		if (!this.data.route) {
			console.error(`Received route points before route.`);
			return;
		}

		this.reactiveObjectProvider.set(this.data, "route", {
			...this.data.route,
			trackPoints: mergeTrackPoints(reset ? {} : this.data.route.trackPoints, trackPoints)
		});
	}

	protected _getEventHandlers(): {
		[E in EventName<ClientEvents>]?: EventHandler<ClientEvents, E>
	} {
		return mergeEventHandlers(super._getEventHandlers(), {
			route: (routeKey, route) => {
				if (routeKey === this.data.routeKey) {
					this.storeRoute(route);
				}
			},

			routePoints: (routeKey, data) => {
				if (routeKey === this.data.routeKey) {
					this.storeRoutePoints(data.trackPoints, data.reset);
				}
			}
		});
	};

	async exportRoute(data: { format: ExportFormat }): ReturnType<ApiV3<true>["exportLine"]> {
		return await this.client.exportRoute(this.data.routeKey, data);
	}

}