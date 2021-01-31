import Socket from "facilmap-client";
import { PadData } from "facilmap-types";
import { UnsavedView } from "./views";

export async function getInitialView(socket: Socket): Promise<UnsavedView | undefined> {
	if(socket.padId) {
		const padData = socket.padData || await new Promise<PadData>((resolve) => {
			socket.on("padData", resolve);
		});

		return padData.defaultView;
	}

	try {
		const geoip = await socket.geoip();

		if (geoip) {
			return { ...geoip, baseLayer: undefined as any, layers: [] };
		}
	} catch (err) {
		console.error("Error contacting GeoIP service", err);
	}

	return undefined;
}