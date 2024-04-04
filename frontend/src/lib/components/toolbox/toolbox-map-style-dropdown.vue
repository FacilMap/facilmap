<script setup lang="ts">
	import { getLayers, setBaseLayer, toggleOverlay } from "facilmap-leaflet";
	import { computed } from "vue";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import Icon from "../ui/icon.vue";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

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
		const { baseLayers } = getLayers(mapContext.value.components.map);
		return Object.keys(baseLayers).map((key) => ({
			key,
			name: baseLayers[key].options.fmName!,
			active: mapContext.value.layers.baseLayer === key
		}));
	});

	const overlays = computed(() => {
		const { overlays } = getLayers(mapContext.value.components.map);
		return Object.keys(overlays).map((key) => ({
			key,
			name: overlays[key].options.fmName!,
			active: mapContext.value.layers.overlays.includes(key)
		}));
	});

	function doSetBaseLayer(key: string): void {
		setBaseLayer(mapContext.value.components.map, key);
	}

	function doToggleOverlay(key: string): void {
		toggleOverlay(mapContext.value.components.map, key);
	}
</script>

<template>
	<DropdownMenu
		tag="li"
		class="nav-item fm-toolbox-map-style-dropdown"
		isLink
		buttonClass="nav-link"
		menuClass="dropdown-menu-end"
		:label="i18n.t('toolbox-map-style-dropdown.label')"
	>
		<li v-for="layerInfo in baseLayers" :key="layerInfo.key">
			<a
				class="dropdown-item"
				:class="{ active: layerInfo.active }"
				href="javascript:"
				@click.capture.stop="doSetBaseLayer(layerInfo.key)"
				draggable="false"
			>{{layerInfo.name}}</a>
		</li>

		<li v-if="baseLayers.length > 0 && overlays.length > 0">
			<hr class="dropdown-divider">
		</li>

		<li v-for="layerInfo in overlays" :key="layerInfo.key">
			<a
				class="dropdown-item"
				:class="{ active: layerInfo.active }"
				href="javascript:"
				@click.capture.stop="doToggleOverlay(layerInfo.key)"
				draggable="false"
			>{{layerInfo.name}}</a>
		</li>

		<li>
			<hr class="dropdown-divider">
		</li>

		<li>
			<a
				class="dropdown-item fm-toolbox-new-window-item"
				:href="links.osm"
				target="_blank"
				draggable="false"
			>
				<span>{{i18n.t("toolbox-map-style-dropdown.openstreetmap")}}</span>
				<Icon icon="new-window"></Icon>
			</a>
		</li>

		<li v-if="!context.hideCommercialMapLinks">
			<a
				class="dropdown-item fm-toolbox-new-window-item"
				:href="links.google"
				target="_blank"
				draggable="false"
			>
				<span>{{i18n.t("toolbox-map-style-dropdown.google-maps")}}</span>
				<Icon icon="new-window"></Icon>
			</a>
		</li>

		<li v-if="!context.hideCommercialMapLinks">
			<a
				class="dropdown-item fm-toolbox-new-window-item"
				:href="links.googleSatellite"
				target="_blank"
				draggable="false"
			>
				<span>{{i18n.t("toolbox-map-style-dropdown.google-maps-satellite")}}</span>
				<Icon icon="new-window"></Icon>
			</a>
		</li>

		<li v-if="!context.hideCommercialMapLinks">
			<a
				class="dropdown-item fm-toolbox-new-window-item"
				:href="links.bing"
				target="_blank"
				draggable="false"
			>
				<span>{{i18n.t("toolbox-map-style-dropdown.bing-maps")}}</span>
				<Icon icon="new-window"></Icon>
			</a>
		</li>
	</DropdownMenu>
</template>