import type { ApiV3, DeepReadonly, EventHandler, EventName, ExportResult, Route, SocketApi, SocketVersion, SubscribeToRouteOptions, TrackPoints } from "facilmap-types";
import { type ClientEvents, type SocketClient } from "./socket-client";
import { type ReactiveObjectProvider } from "./reactivity";
import { mergeEventHandlers } from "./utils";
import { SocketClientSubscription, type BasicSubscriptionData } from "./socket-client-subscription";

type SocketClientRouteSubscriptionInterface = {
	[K in (
		"exportRouteAsGpx" | "exportRouteAsGeoJson"
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

export class SocketClientRouteSubscription extends SocketClientSubscription<RouteSubscriptionData> implements SocketClientRouteSubscriptionInterface {
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

	protected _getEventHandlers(): {
		[E in EventName<ClientEvents>]?: EventHandler<ClientEvents, E>
	} {
		return mergeEventHandlers(super._getEventHandlers(), {});
	};

	async exportRouteAsGpx(options?: { rte?: boolean }): Promise<ExportResult> {
		return await this.client.exportRouteAsGpx(this.data.routeKey, options);
	}

	async exportRouteAsGeoJson(): Promise<ExportResult> {
		return await this.client.exportRouteAsGeoJson(this.data.routeKey);
	}

}