import { Layer, Map, tileLayer, type TileLayer } from "leaflet";
import AutoGraticule from "leaflet-auto-graticule";
import FreieTonne from "leaflet-freie-tonne";
import { getI18n } from "./utils/i18n";
import { markdownInline } from "facilmap-utils";

export const defaultVisibleLayers: VisibleLayers = {
	get baseLayer() {
		return layerOptions.limaLabsToken ? 'Lima' : 'Mpnk';
	},
	overlays: []
};

export interface Layers {
	baseLayers: Record<string, Layer>;
	overlays: Record<string, Layer>;
}

function getter<P1 extends keyof any, P2 extends keyof any, R>(prop: P1, getProp: P2, get: () => R): Record<P1, R> & Record<P2, () => R> {
	return {
		[prop]: get(),
		[getProp]: get
	} as any;
}

const fmName = (get: () => string) => getter("fmName", "fmGetName", get);
const attribution = (get: () => string) => getter("attribution", "fmGetAttribution", () => markdownInline(get(), true));
const fixAttribution = <T extends Layer>(layer: T): T => Object.assign(layer, { getAttribution(this: any) { return this.options.fmGetAttribution()!; } }) as any;

export function createDefaultLayers(): Layers & { fallbackLayer: string | undefined } {
	return {
		baseLayers: {
			...(layerOptions.limaLabsToken ? {
				Lima: fixAttribution(tileLayer(`https://cdn.lima-labs.com/{z}/{x}/{y}.png?api=${encodeURIComponent(layerOptions.limaLabsToken)}`, {
					...fmName(() => getI18n().t("layers.lima-name")),
					...attribution(() => getI18n().t("layers.lima-attribution")),
					noWrap: true
				}))
			} : {}),

			Mpnk: fixAttribution(tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
				...fmName(() => getI18n().t("layers.mpnk-name")),
				...attribution(() => getI18n().t("layers.mpnk-attribution")),
				noWrap: true
			})),

			/*MSfR: tileLayer('https://maps.heigit.org/openmapsurfer/tiles/roads/webmercator/{z}/{x}/{y}.png', {
				fmName: "MapSurfer Road",
				attribution: '© <a href="https://openrouteservice.org/" target="_blank">OpenRouteService</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>',
				noWrap: true
			})*/

			ToPl: fixAttribution(tileLayer("https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/{z}/{y}/{x}.png", {
				...fmName(() => getI18n().t("layers.topl-name")),
				...attribution(() => getI18n().t("layers.topl-attribution", { year: new Date().getFullYear() })),
				noWrap: true
			})),

			Map1: fixAttribution(tileLayer("http://beta.map1.eu/tiles/{z}/{x}/{y}.jpg", {
				...fmName(() => getI18n().t("layers.map1-name")),
				...attribution(() => getI18n().t("layers.map1-attribution")),
				noWrap: true
			})),

			Topo: fixAttribution(tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
				...fmName(() => getI18n().t("layers.topo-name")),
				...attribution(() => getI18n().t("layers.topo-attribution")),
				noWrap: true
			})),

			CycO: fixAttribution(tileLayer("https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png", {
				...fmName(() => getI18n().t("layers.cyco-name")),
				...attribution(() => getI18n().t("layers.cyco-attribution")),
				noWrap: true
			})),

			OCyc: fixAttribution(tileLayer("https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=bc74ceb5f91c448b9615f9b576c61c16", {
				...fmName(() => getI18n().t("layers.ocyc-name")),
				...attribution(() => getI18n().t("layers.ocyc-attribution")),
				noWrap: true
			})),

			HiBi: fixAttribution(tileLayer("https://tiles.wmflabs.org/hikebike/{z}/{x}/{y}.png", {
				...fmName(() => getI18n().t("layers.hobi-name")),
				...attribution(() => getI18n().t("layers.hobi-attribution")),
				noWrap: true
			})),

			MpnW: fixAttribution(tileLayer("http://ftdl.de/tile-cache/tiles/{z}/{x}/{y}.png", {
				...fmName(() => getI18n().t("layers.mpnw-name")),
				...attribution(() => getI18n().t("layers.mpnw-attribution")),
				noWrap: true
			})),
		},
		overlays: {
			OPTM: fixAttribution(tileLayer("http://openptmap.org/tiles/{z}/{x}/{y}.png", {
				...fmName(() => getI18n().t("layers.optm-name")),
				...attribution(() => getI18n().t("layers.optm-attribution")),
				zIndex: 300,
				noWrap: true
			})),

			Hike: fixAttribution(tileLayer("https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png", {
				...fmName(() => getI18n().t("layers.hike-name")),
				...attribution(() => getI18n().t("layers.hike-attribution")),
				zIndex: 300,
				noWrap: true
			})),

			Bike: fixAttribution(tileLayer("https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png", {
				...fmName(() => getI18n().t("layers.bike-name")),
				...attribution(() => getI18n().t("layers.bike-attribution")),
				zIndex: 300,
				noWrap: true
			})),

			Rlie: tileLayer("https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png", {
				maxZoom: 16,
				...fmName(() => getI18n().t("layers.rlie-name")),
				zIndex: 300,
				noWrap: true
			}),

			grid: new AutoGraticule({
				...fmName(() => getI18n().t("layers.grid-name")),
				zIndex: 300,
				noWrap: true
			}),

			FrTo: fixAttribution(new FreieTonne({
				...fmName(() => getI18n().t("layers.frto-name")),
				...attribution(() => getI18n().t("layers.frto-attribution")),
				zIndex: 300,
				noWrap: true
			}))
		},
		fallbackLayer: 'Mpnk'
	};
};

let createLayers = createDefaultLayers;

export function setLayers(create: typeof createDefaultLayers): void {
	createLayers = create;
}

export interface LayerOptions {
	limaLabsToken?: string;
}

let layerOptions: LayerOptions = {};

export function getLayerOptions(): LayerOptions {
	return layerOptions;
}

export function setLayerOptions(options: LayerOptions): void {
	layerOptions = options;
}

export function getLayers(map: Map): Layers {
	if (!map._fmLayers) {
		const { baseLayers, overlays, fallbackLayer } = createLayers();

		for (const [key, layer] of Object.entries(baseLayers)) {
			layer.on("tileerror", (err) => {
				const fallback = fallbackLayer && fallbackLayer != key && baseLayers[fallbackLayer] as TileLayer | undefined;
				if (fallback) {
					fallback['_tileZoom'] = err.target._tileZoom;
					const fallbackUrl = fallback.getTileUrl(err.coords);
					if(err.tile.src != fallbackUrl)
						err.tile.src = fallbackUrl;
				}

				console.log('tileerror', err, err.target.getTileUrl(err.coords));
			});
		}

		map._fmLayers = { baseLayers, overlays };
	}

	return map._fmLayers;
}

export interface VisibleLayers {
	baseLayer: string;
	overlays: string[];
}

export function getVisibleLayers(map: Map): VisibleLayers {
	const layers = getLayers(map);

	return {
		baseLayer: Object.keys(layers.baseLayers).find((key) => map.hasLayer(layers.baseLayers[key]))!,
		overlays: Object.keys(layers.overlays).filter((key) => map.hasLayer(layers.overlays[key]))
	};
}

export function setVisibleLayers(map: Map, { baseLayer = defaultVisibleLayers.baseLayer, overlays: overlaysArg = defaultVisibleLayers.overlays } = {}): void {
	const layers = getLayers(map);
	const visibleLayers = getVisibleLayers(map);

	if (visibleLayers.baseLayer !== baseLayer) {
		if (visibleLayers.baseLayer != null)
			map.removeLayer(layers.baseLayers[visibleLayers.baseLayer]);
		map.addLayer(layers.baseLayers[baseLayer] || layers.baseLayers[defaultVisibleLayers.baseLayer]);
	}

	for (const key of visibleLayers.overlays.filter((k) => !overlaysArg.includes(k))) {
		map.removeLayer(layers.overlays[key]);
	}
	for (const key of overlaysArg.filter((k) => !visibleLayers.overlays.includes(k))) {
		if (layers.overlays[key])
			map.addLayer(layers.overlays[key]);
	}
}

export function setBaseLayer(map: Map, baseLayer: string): void {
	const visibleLayers = getVisibleLayers(map);
	setVisibleLayers(map, { ...visibleLayers, baseLayer });
}

export function toggleOverlay(map: Map, overlay: string): void {
	const visibleLayers = getVisibleLayers(map);
	if (visibleLayers.overlays.includes(overlay))
		setVisibleLayers(map, { ...visibleLayers, overlays: visibleLayers.overlays.filter((o) => o !== overlay) });
	else
	setVisibleLayers(map, { ...visibleLayers, overlays: [...visibleLayers.overlays, overlay] });
}
