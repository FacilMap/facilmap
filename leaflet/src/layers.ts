import L, { Layer, Map, TileLayer } from "leaflet";
import "leaflet-auto-graticule";
import "leaflet-freie-tonne";

declare module "leaflet" {
    interface FmLayerOptions {
        fmName?: string;
    }

    interface LayerOptions extends FmLayerOptions {}
}

export let defaultLayerKey = 'Mpnk';

export const baseLayers: Record<string, Layer> = {
    [defaultLayerKey]: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        fmName: "Mapnik",
        attribution: '© <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>',
        noWrap: true
    }),

    /*MSfR: L.tileLayer('https://maps.heigit.org/openmapsurfer/tiles/roads/webmercator/{z}/{x}/{y}.png', {
        fmName: "MapSurfer Road",
        fmBase: true,
        attribution: '© <a href="https://openrouteservice.org/" target="_blank">OpenRouteService</a> / <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>',
        noWrap: true
    })*/

    ToPl: L.tileLayer("https://sg.geodatenzentrum.de/wmts_topplus_web_open/tile/1.0.0/web/default/WEBMERCATOR/{z}/{y}/{x}.png", {
        fmName: "TopPlus",
        attribution: '© <a href="https://www.bkg.bund.de/">Bundesamt für Kartographie und Geodäsie</a> ' + (new Date()).getFullYear()
    }),

    Map1: L.tileLayer("http://beta.map1.eu/tiles/{z}/{x}/{y}.jpg", {
        fmName: "Map1.eu",
        attribution: '© <a href="http://map1.eu/" target="_blank">Map1.eu</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>',
        noWrap: true
    }),
    
    Topo: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
        fmName: "OpenTopoMap",
        attribution: '© <a href="https://opentopomap.org/" target="_blank">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank">CC-BY-SA</a>) / <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>'
    }),
    
    OCyc: L.tileLayer("https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=bc74ceb5f91c448b9615f9b576c61c16", {
        fmName: "OpenCycleMap",
        attribution: '© <a href="https://opencyclemap.org/" target="_blank">OpenCycleMap</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>',
        noWrap: true
    }),

    HiBi: L.tileLayer("https://tiles.wmflabs.org/hikebike/{z}/{x}/{y}.png", {
        fmName: "Hike & Bike Map",
        attribution: '© <a href="http://hikebikemap.org/" target="_blank">Hike &amp; Bike Map</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>',
        noWrap: true
    }),

    MpnW: L.tileLayer("https://www.freietonne.de/seekarte/tah.openstreetmap.org/Tiles/TileCache.php?z={z}&x={x}&y={y}.png", {
        fmName: "Mapnik Water",
        attribution: '© <a href="https://www.freietonne.de/" target="_blank">FreieTonne</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>',
        noWrap: true
    })
};

export const overlays: Record<string, Layer> = {
    OPTM: L.tileLayer("http://openptmap.org/tiles/{z}/{x}/{y}.png", {
        fmName: "Public transportation",
        attribution: '© <a href="http://openptmap.org/" target="_blank">OpenPTMap</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>',
        zIndex: 300,
        noWrap: true
    }),

    Hike: L.tileLayer("https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png", {
        fmName: "Hiking paths",
        attribution: '© <a href="https://hiking.waymarkedtrails.org/" target="_blank">Waymarked Trails</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>',
        zIndex: 300,
        noWrap: true
    }),

    Bike: L.tileLayer("https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png", {
        fmName: "Bicycle routes",
        attribution: '© <a href="https://cycling.waymarkedtrails.org/" target="_blank">Waymarked Trails</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a>',
        zIndex: 300,
        noWrap: true
    }),

    Rlie: L.tileLayer("https://maps.heigit.org/openmapsurfer/tiles/asterh/webmercator/{z}/{x}/{y}.png", {
        fmName: "Relief",
        attribution: '© <a href="https://openrouteservice.org/" target="_blank">OpenRouteService</a> / <a href="http://www.meti.go.jp/english/press/data/20090626_03.html" target="_blank">METI</a> / <a href="https://lpdaac.usgs.gov/products/aster_policies" target="_blank">NASA</a>',
        zIndex: 300,
        noWrap: true
    }),

    grid: L.autoGraticule({
        fmName: "Graticule",
        zIndex: 300,
        noWrap: true
    }),

    FrTo: L.freieTonne({
        fmName: "Sea marks",
        zIndex: 300,
        noWrap: true
    })
};

for (const key of Object.keys(baseLayers)) {
    if(key !== defaultLayerKey) {
        baseLayers[key].on("tileerror", (err) => {
            const defaultLayer = baseLayers[defaultLayerKey] as TileLayer;
            defaultLayer['_tileZoom'] = err.target._tileZoom;
            const fallbackUrl = defaultLayer.getTileUrl(err.coords);
            if(err.tile.src != fallbackUrl)
                err.tile.src = fallbackUrl;
        });
    }
}

export interface VisibleLayers {
    baseLayer: string;
    layers: string[];
}

export function getVisibleLayers(map: Map): VisibleLayers {
    return {
        baseLayer: Object.keys(baseLayers).find((key) => map.hasLayer(baseLayers[key]))!,
        layers: Object.keys(overlays).filter((key) => map.hasLayer(overlays[key]))
    };
}

export function setVisibleLayers(map: Map, { baseLayer = defaultLayerKey, layers = [] }: Partial<VisibleLayers> = { }) {
    const visibleLayers = getVisibleLayers(map);

    if (visibleLayers.baseLayer !== baseLayer) {
        if (visibleLayers.baseLayer != null)
            map.removeLayer(baseLayers[visibleLayers.baseLayer]);
        map.addLayer(baseLayers[baseLayer]);
    }

    for (const key of visibleLayers.layers.filter((k) => !layers.includes(k))) {
        map.removeLayer(overlays[key]);
    }
    for (const key of layers.filter((k) => !visibleLayers.layers.includes(k))) {
        map.addLayer(overlays[key]);
    }
}
