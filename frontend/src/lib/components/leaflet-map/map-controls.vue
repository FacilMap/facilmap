<script setup lang="ts">
	import { computed, ref, toRef } from "vue";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { useI18n } from "../../utils/i18n";
	import Icon from "../ui/icon.vue";
	import vTooltip, { type TooltipPlacement } from "../../utils/tooltip";
	import { dynamicModifiers } from "../../utils/vue";
	import AboutDialog from "../about-dialog/about-dialog.vue";

	const context = injectContextRequired();
	const i18n = useI18n();
	const mapContext = toRef(() => context.components.map);

	const props = defineProps<{
		tooltipPlacement?: TooltipPlacement;
	}>();

	const aboutDialogOpen = ref(false);
	const aboutButtonRef = ref<HTMLElement>();

	function zoomIn(ev: MouseEvent) {
		mapContext.value!.components.map.zoomIn(mapContext.value!.components.map.options.zoomDelta! * (ev.shiftKey ? 3 : 1));
	}

	function zoomOut(ev: MouseEvent) {
		mapContext.value!.components.map.zoomOut(mapContext.value!.components.map.options.zoomDelta! * (ev.shiftKey ? 3 : 1));
	}

	const vPositionedTooltip = dynamicModifiers(vTooltip, computed(() => props.tooltipPlacement ? { [props.tooltipPlacement]: true } : {}));
</script>

<template>
	<div class="fm-leaflet-map-controls" :class="{ isNarrow: context.isNarrow }">
		<div :class="context.isNarrow ? '' : 'btn-group-vertical'" class="fm-leaflet-map-controls-zoom" role="group" style="grid-area: zoom">
			<button
				type="button"
				class="btn btn-outline-secondary"
				:aria-label="i18n.t('leaflet-map.zoom-in')"
				:disabled="!mapContext || mapContext.zoom >= mapContext.maxZoom"
				@click="zoomIn($event)"
				style="grid-area: zoom-in"
			>
				<span aria-hidden="true">+</span>
			</button>
			<button
				type="button"
				class="btn btn-outline-secondary"
				:aria-label="i18n.t('leaflet-map.zoom-out')"
				:disabled="!mapContext || mapContext.zoom <= mapContext.minZoom"
				@click="zoomOut($event)"
				style="grid-area: zoom-out"
			>
				<span aria-hidden="true">&minus;</span>
			</button>
		</div>

		<div
			v-if="context.settings.locate"
			class="fm-leaflet-map-controls-locate leaflet-control-locate"
			style="grid-area: locate"
		>
			<a
				class="btn btn-outline-secondary"
				href="javascript:"
				:aria-label="i18n.t('leaflet-map.locate')"
				v-positioned-tooltip="i18n.t('leaflet-map.locate')"
				@click.stop.prevent="(mapContext?.components.locateControl as any)?._onClick()"
			>
				<Icon icon="screenshot" size="16px" class="leaflet-locate-icon"></Icon>
			</a>
		</div>

		<button
			type="button"
			class="btn btn-outline-secondary fm-leaflet-map-controls-about"
			:aria-label="i18n.t('leaflet-map.about', { appName: context.appName })"
			v-positioned-tooltip="i18n.t('leaflet-map.about', { appName: context.appName })"
			style="grid-area: about"
			ref="aboutButtonRef"
			@click="aboutDialogOpen = true"
		>?</button>

		<AboutDialog
			v-if="aboutDialogOpen"
			:animationReference="aboutButtonRef"
			@hidden="aboutDialogOpen = false"
		></AboutDialog>
	</div>
</template>

<style lang="scss">
	.fm-leaflet-map-controls {
		display: grid;
		grid-template-areas: "zoom" "locate" "about";
		gap: 10px;

		.btn.btn {
			width: 34px;
			height: 34px;
			padding: 0;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			--bs-btn-bg: var(--bs-body-bg);

			&.btn-outline-secondary {
				--bs-btn-color: var(--bs-body-color);
			}
		}

		.fm-leaflet-map-controls-zoom button {
			font-size: 22px;
		}

		.fm-leaflet-map-controls-about {
			font-size: 18px;
			font-weight: bold;
		}

		.leaflet-control-locate.leaflet-control-locate {
			&.active a {
				color: rgb(32, 116, 182);
			}

			&.following a {
				color: rgb(252, 132, 40);
			}
		}

		&.isNarrow {
			grid-template-areas: ". about" ". zoom-in" "locate zoom-out";

			.fm-leaflet-map-controls-zoom {
				display: contents;
			}
		}
	}
</style>