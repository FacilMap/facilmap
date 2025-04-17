<script setup lang="ts">
	import { getLayers, setBaseLayer, toggleOverlay } from "facilmap-leaflet";
	import { computed } from "vue";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import Icon from "../ui/icon.vue";
	import { useI18n } from "../../utils/i18n";
	import { getExternalLinks } from "../../utils/external-links";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const externalLinks = computed(() => getExternalLinks({
		lat: mapContext.value.center.lat,
		lon: mapContext.value.center.lng,
		zoom: mapContext.value.zoom
	}, "map", context.hideCommercialMapLinks));

	const baseLayers = computed(() => {
		const { baseLayers } = getLayers(mapContext.value.components.map);
		return Object.keys(baseLayers).map((key) => ({
			key,
			name: baseLayers[key].options.fmGetName!(),
			active: mapContext.value.layers.baseLayer === key
		}));
	});

	const overlays = computed(() => {
		const { overlays } = getLayers(mapContext.value.components.map);
		return Object.keys(overlays).map((key) => ({
			key,
			name: overlays[key].options.fmGetName?.() ?? overlays[key].options.fmName!,
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

		<li v-for="link in externalLinks" :key="link.key">
			<a
				class="dropdown-item fm-toolbox-new-window-item"
				:href="link.href"
				:target="link.target"
				draggable="false"
			>
				<span>{{link.label}}</span>
				<Icon icon="new-window"></Icon>
			</a>
		</li>
	</DropdownMenu>
</template>