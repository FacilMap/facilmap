import type Client from "facilmap-client";
import type { PadData } from "facilmap-types";
import type { UnsavedView } from "./views";

export async function getInitialView(client: Client): Promise<UnsavedView | undefined> {
	if(client.padId) {
		const padData = client.padData || await new Promise<PadData>((resolve, reject) => {
			client.on("padData", resolve);
			client.on("serverError", reject);

			if (client.serverError)
				reject(client.serverError);
		});

		return padData.defaultView ?? undefined;
	}

	try {
		const geoip = await client.geoip();

		if (geoip) {
			return { ...geoip, baseLayer: undefined as any, layers: [] };
		}
	} catch (err) {
		console.error("Error contacting GeoIP service", err);
	}

	return undefined;
}