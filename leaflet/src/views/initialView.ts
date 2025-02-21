import type Client from "facilmap-client";
import type { MapData } from "facilmap-types";
import type { PartialView } from "./views";

export async function getInitialView(client: Client): Promise<PartialView | undefined> {
	if(client.mapId) {
		const mapData = client.mapData || await new Promise<MapData>((resolve, reject) => {
			client.on("mapData", resolve);
			client.on("serverError", reject);

			if (client.serverError)
				reject(client.serverError);
		});

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