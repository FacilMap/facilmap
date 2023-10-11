<script setup lang="ts">
	import { getLayers, setBaseLayer, toggleOverlay } from "facilmap-leaflet";
	import { computed } from "vue";
	import { injectMapComponentsRequired } from "../../utils/map-components";
	import { injectMapContextRequired } from "../../utils/map-context";

	const mapComponents = injectMapComponentsRequired();
	const mapContext = injectMapContextRequired();

	const links = computed(() => {
		const v = mapContext.value;
		return {
			osm: `https://www.openstreetmap.org/#map=${v.zoom}/${v.center.lat}/${v.center.lng}`,
			google: `https://www.google.com/maps/@?api=1&map_action=map&center=${v.center.lat},${v.center.lng}&zoom=${v.zoom}`,
			googleSatellite: `https://www.google.com/maps/@?api=1&map_action=map&center=${v.center.lat},${v.center.lng}&zoom=${v.zoom}&basemap=satellite`,
			bing: `https://www.bing.com/maps?cp=${v.center.lat}~${v.center.lng}&lvl=${v.zoom}`
		};
	});

	const baseLayers = computed(() => {
		const { baseLayers } = getLayers(mapComponents.value.map);
		return Object.keys(baseLayers).map((key) => ({
			key,
			name: baseLayers[key].options.fmName!,
			active: mapContext.value.layers.baseLayer === key
		}));
	});

	const overlays = computed(() => {
		const { overlays } = getLayers(mapComponents.value.map);
		return Object.keys(overlays).map((key) => ({
			key,
			name: overlays[key].options.fmName!,
			active: mapContext.value.layers.overlays.includes(key)
		}));
	});

	function doSetBaseLayer(key: string): void {
		setBaseLayer(mapComponents.value.map, key);
	}

	function doToggleOverlay(key: string): void {
		toggleOverlay(mapComponents.value.map, key);
	}
</script>

<template>
	<li class="nav-item dropdown">
		<a
			class="nav-link dropdown-toggle"
			href="javascript:"
			data-bs-toggle="dropdown"
		>Map style</a>
		<ul class="dropdown-menu dropdown-menu-end">
			<li v-for="layerInfo in baseLayers">
				<a
					class="dropdown-item"
					:class="{ active: layerInfo.active }"
					href="javascript:"
					@click.native.capture.stop="doSetBaseLayer(layerInfo.key)"
				>{{layerInfo.name}}</a>
			</li>

			<li v-if="baseLayers.length > 0 && overlays.length > 0">
				<hr class="dropdown-divider">
			</li>

			<li v-for="layerInfo in overlays">
				<a
					class="dropdown-item"
					:class="{ active: layerInfo.active }"
					href="javascript:"
					@click.native.capture.stop="doToggleOverlay(layerInfo.key)"
				>{{layerInfo.name}}</a>
			</li>

			<li>
				<hr class="dropdown-divider">
			</li>

			<li>
				<a
					class="dropdown-item"
					:href="links.osm"
					target="_blank"
				>Open this on OpenStreetMap</a>
			</li>

			<li>
				<a
					class="dropdown-item"
					:href="links.google"
					target="_blank"
				>Open this on Google Maps</a>
			</li>

			<li>
				<a
					class="dropdown-item"
					:href="links.googleSatellite"
					target="_blank"
				>Open this on Google Maps (Satellite)</a>
			</li>

			<li>
				<a
					class="dropdown-item"
					:href="links.bing"
					target="_blank"
				>Open this on Bing Maps</a>
			</li>
		</ul>
	</li>
</template>