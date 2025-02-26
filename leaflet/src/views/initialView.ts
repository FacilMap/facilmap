import type { SocketClient, SocketClientStorage } from "facilmap-client";
import type { DeepReadonly, MapSlug } from "facilmap-types";
import type { PartialView } from "./views";

export async function getInitialView(clientOrStorage: SocketClient | SocketClientStorage, mapSlug?: MapSlug): Promise<DeepReadonly<PartialView> | undefined> {
	let [storage, client] = "client" in clientOrStorage ? [clientOrStorage, clientOrStorage.client] : [undefined, clientOrStorage];

	if (mapSlug) {
		const mapData = storage?.maps[mapSlug]?.mapData ?? await client.getMap(mapSlug);
		return mapData.defaultView ?? undefined;
	}

	try {
		const geoip = await client.geoip();

		if (geoip) {
			return { ...geoip, baseLayer: undefined, layers: undefined };
		}
	} catch (err) {
		console.error("Error contacting GeoIP service", err);
	}

	return undefined;
}