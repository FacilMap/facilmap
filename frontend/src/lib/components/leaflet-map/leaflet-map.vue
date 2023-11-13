<script setup lang="ts">
	import { type Ref, computed, onMounted, ref } from "vue";
	import "leaflet/dist/leaflet.css";
	import "leaflet.locatecontrol";
	import "leaflet.locatecontrol/dist/L.Control.Locate.css";
	import "leaflet-graphicscale";
	import "leaflet-graphicscale/src/Leaflet.GraphicScale.scss";
	import "leaflet-mouse-position";
	import "leaflet-mouse-position/src/L.Control.MousePosition.css";
	import { useMapContext } from "./leaflet-map-components";
	import vTooltip from "../../utils/tooltip";
	import type { WritableMapContext } from "../facil-map-context-provider/map-context";
	import { injectContextRequired, requireClientContext } from "../facil-map-context-provider/facil-map-context-provider.vue";

	const context = injectContextRequired();
	const client = requireClientContext(context);

	const innerContainerRef = ref<HTMLElement>();
	const mapRef = ref<HTMLElement>();

	const loaded = ref(false);
	const fatalError = ref<string>();

	const selfUrl = computed(() => {
		return `${location.origin}${location.pathname}${mapContext.value?.hash ? `#${mapContext.value.hash}` : ''}`;
	});

	const mapContext = ref<WritableMapContext>();

	onMounted(async () => {
		try {
			mapContext.value = await useMapContext(context, mapRef as Ref<HTMLElement>, innerContainerRef as Ref<HTMLElement>);
			loaded.value = true;
		} catch (err: any) {
			console.error(err);
			fatalError.value = err.message;
		}
	});

	context.provideComponent("map", mapContext);
</script>

<template>
	<div class="fm-leaflet-map-container" :class="{ isNarrow: context.isNarrow }">
		<slot v-if="mapContext" name="before"></slot>

		<div class="fm-leaflet-map-wrapper">
			<div class="fm-leaflet-map-inner-container" ref="innerContainerRef">
				<div class="fm-leaflet-map" ref="mapRef"></div>

				<div v-if="mapContext && mapContext.overpassMessage" class="alert alert-warning fm-overpass-message">
					{{mapContext.overpassMessage}}
				</div>

				<a
					v-if="context.settings.linkLogo"
					:href="selfUrl"
					target="_blank"
					class="fm-open-external"
					v-tooltip.right="'Open FacilMap in full size'"
				></a>
				<div class="fm-logo">
					<img src="./logo.png"/>
				</div>

				<div class="spinner-border fm-leaflet-map-spinner" v-show="client.loading > 0 || (mapContext && mapContext.loading > 0)"></div>

				<slot v-if="mapContext"></slot>
			</div>
			<slot v-if="mapContext" name="after"></slot>
		</div>

		<div class="fm-leaflet-map-disabled-cover" v-show="client.padId && (client.disconnected || (client.serverError && !client.isCreatePad) || client.deleted)"></div>
		<div class="fm-leaflet-map-loading" v-show="!loaded && !client.serverError && !client.isCreatePad" :class="{ 'fatal-error': !!fatalError }">
			{{fatalError || 'Loading...'}}
		</div>
	</div>
</template>

<style lang="scss">
	.fm-leaflet-map-container {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		position: relative;

		.fm-leaflet-map-wrapper {
			display: flex;
			flex-direction: column;
			flex-grow: 1;
			position: relative;
		}

		.fm-leaflet-map-inner-container {
			position: relative;
			flex-grow: 1;
		}

		.fm-leaflet-map {
			position: absolute;
			top: 0;
			right: 0;
			left: 0;
			bottom: 0;
			z-index: 0;
			user-select: none;
			-webkit-user-select: none;

			.fm-leaflet-center {
				left: 50%;
				transform: translateX(-50%);
				text-align: center;

				.leaflet-control {
					display: inline-block;
					float: none;
					clear: none;
				}
			}

			.leaflet-control.leaflet-control-mouseposition {
				float: left;
				pointer-events: none;
				padding-right: 0;

				&:after {
					content: " |";
				}

				& + * {
					clear: none;
				}
			}

			.leaflet-control.leaflet-control-graphicscale {
				margin-bottom: 0;
				pointer-events: none;

				.label {
					color: #000;
					text-shadow: 0 0 3px #fff, 0 0 5px #fff, 0 0 10px #fff;
				}
			}

			.leaflet-control-locate.leaflet-control-locate a {
				font-size: inherit;
				display: inline-flex;
				align-items: center;
				justify-content: center;
			}

		}

		&.isNarrow {
			.leaflet-control-graphicscale,.leaflet-control-mouseposition {
				display: none !important;
			}
		}

		.fm-leaflet-map-disabled-cover {
			background-color: #888;
			opacity: 0.7;
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			z-index: 10001;
		}

		.fm-leaflet-map-loading {
			position:absolute;
			top:0;
			left:0;
			right:0;
			bottom:0;
			padding:10px;
			background: #fff;
			z-index:100000;
			font-size:1.5em;
			font-weight:bold;

			&.fatal-error {
				color: #d00;
			}
		}

		.fm-overpass-message {
			position: absolute;
			top: 10px;
			right: 50%;
			transform: translateX(50%);
			max-width: calc(100vw - 1050px);
		}

		&.isNarrow .fm-overpass-message {
			max-width: none;
		}

		@media(max-width: 1250px) {
			&:not(.isNarrow) .fm-overpass-message {
				top: 69px;
				right: 10px;
				transform: none;
				max-width: 400px;
			}
		}

		.fm-leaflet-map-spinner {
			position:absolute;
			bottom: 20px;
			left: 115px;
			color: #00272a;
		}

		.fm-logo {
			position: absolute;
			bottom: 0;
			left: -25px;
			pointer-events: none;
			overflow: hidden;
			user-select: none;
			-webkit-user-select: none;

			img {
				margin-bottom: -24px;
			}
		}

		.fm-open-external {
			position: absolute;
			bottom: 15px;
			left: 15px;
			width: 90px;
			height: 50px;
		}

	}
</style>