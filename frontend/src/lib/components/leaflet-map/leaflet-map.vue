<script setup lang="ts">
	import { type Ref, onMounted, ref } from "vue";
	import { useMapContext } from "./leaflet-map-components";
	import type { WritableMapContext } from "../facil-map-context-provider/map-context";
	import { injectContextRequired, requireClientContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { useI18n, vReplaceLinks } from "../../utils/i18n";
	import AboutDialog from "../about-dialog/about-dialog.vue";
	import { markdownInline, quoteMarkdown } from "facilmap-utils";
	import MapControls from "./map-controls.vue";
	import Logo from "./logo.vue";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const i18n = useI18n();

	const innerContainerRef = ref<HTMLElement>();
	const mapRef = ref<HTMLElement>();

	const loaded = ref(false);
	const fatalError = ref<string>();
	const showNarrowAttribution = ref(true);
	const aboutDialogOpen = ref(false);

	const mapContext = ref<WritableMapContext>();

	onMounted(async () => {
		try {
			mapContext.value = await useMapContext(context, mapRef as Ref<HTMLElement>, innerContainerRef as Ref<HTMLElement>);
			loaded.value = true;
			setTimeout(() => {
				showNarrowAttribution.value = false;
			}, 5000); // According to https://osmfoundation.org/wiki/Licence/Attribution_Guidelines#Interactive_maps we can fade out the attribution after 5 seconds
		} catch (err: any) {
			console.error(err);
			fatalError.value = err.message;
		}
	});

	context.provideComponent("map", mapContext);
</script>

<template>
	<div class="fm-leaflet-map-container" :class="{ isNarrow: context.isNarrow, hasSearchBox: context.components.searchBox?.visible }">
		<slot v-if="mapContext" name="before"></slot>

		<div class="fm-leaflet-map-wrapper">
			<div class="fm-leaflet-map-inner-container" ref="innerContainerRef">
				<div class="fm-leaflet-map" ref="mapRef"></div>

				<div
					class="fm-leaflet-map-narrow-attribution"
					:class="{ visible: showNarrowAttribution }"
					v-html="markdownInline(i18n.t('leaflet-map.attribution-notice', { appName: quoteMarkdown(context.appName) }), true)"
					v-replace-links="{
						'#about-dialog': { onClick: () => { aboutDialogOpen = true; } }
					}"
				></div>
				<AboutDialog
					v-if="aboutDialogOpen"
					@hidden="aboutDialogOpen = false"
				></AboutDialog>

				<div v-if="mapContext && mapContext.overpassMessage" class="alert alert-warning fm-overpass-message">
					{{mapContext.overpassMessage}}
				</div>

				<Logo v-if="mapContext"></Logo>

				<div class="spinner-border fm-leaflet-map-spinner" v-show="client.loading > 0 || (mapContext && mapContext.loading > 0)"></div>

				<MapControls :tooltipPlacement="context.isNarrow ? 'left' : 'right'"></MapControls>

				<slot v-if="mapContext"></slot>
			</div>
			<slot v-if="mapContext" name="after"></slot>
		</div>

		<div class="fm-leaflet-map-disabled-cover" v-show="client.mapId && (client.disconnected || (client.serverError && !client.isCreateMap) || client.deleted)"></div>
		<div class="fm-leaflet-map-loading" v-show="!loaded && !client.serverError && !client.isCreateMap" :class="{ 'fatal-error': !!fatalError }">
			{{fatalError || i18n.t("leaflet-map.loading")}}
		</div>
	</div>
</template>

<style lang="scss">
	.fm-leaflet-map-container {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		position: relative;

		--fm-leaflet-map-inset-bottom: var(--facilmap-inset-bottom);

		&.isNarrow.hasSearchBox {
			--fm-leaflet-map-inset-bottom: 0px;
		}

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
			inset: 0;
			z-index: 0;
			user-select: none;

			.leaflet-control-container {
				> .leaflet-top {
					top: var(--facilmap-inset-top, 0px);
				}

				> .leaflet-right {
					right: var(--facilmap-inset-right, 0px);
				}

				> .leaflet-bottom {
					bottom: var(--fm-leaflet-map-inset-bottom, 0px);
				}

				> .leaflet-left {
					left: var(--facilmap-inset-left, 0px);
				}

				> .fm-leaflet-center {
					left: 50%;
					transform: translateX(-50%);
					text-align: center;
					width: 100%;

					.leaflet-control {
						display: inline-block;
						float: none;
						clear: none;
					}
				}
			}

			.leaflet-control.leaflet-control-mouseposition {
				float: left;
				pointer-events: none;
				padding-right: 0;

				// Make font size the same as attribution control
				font-size: inherit;
				line-height: 1.4;

				&:after {
					content: " |";
				}

				& + * {
					clear: none;
				}
			}

			.leaflet-control.leaflet-control-graphicscale {
				margin-top: 0; // Narrow screens (topcenter)
				margin-bottom: 0; // Wide screens (bottomcenter)

				pointer-events: none;
				color-scheme: only light;

				.label {
					color: #000;
					text-shadow: 0 0 3px #fff, 0 0 5px #fff, 0 0 10px #fff;
				}
			}

			path.leaflet-interactive {
				// Do not show focus ring
				outline: none;
			}

			.leaflet-pane {
				color-scheme: only light;
			}

			.leaflet-control-attribution, .leaflet-control-mouseposition {
				background: rgba(var(--bs-body-bg-rgb), 0.8);
				color: var(--bs-body-color);

				a:not(.fm-donate) {
					color: rgba(var(--bs-link-color-rgb), var(--bs-link-opacity, 1));
				}
			}

		}

		&.isNarrow {
			.leaflet-control.leaflet-control-graphicscale {
				opacity: 0.6;
			}
		}

		.fm-leaflet-map-narrow-attribution {
			position: absolute;
			top: var(--facilmap-inset-top, 0px);
			left: var(--facilmap-inset-left, 0px);
			max-width: calc(100% - 54px - var(--facilmap-inset-left, 0px) - var(--facilmap-inset-right, 0px));
			opacity: 0;
			transition: opacity 1s;
			pointer-events: none;

			// Style like attribution control
			background: rgba(255, 255, 255, 0.8);
			padding: 0 5px;
			color: #333;
			line-height: 1.4;
			font-size: 0.75rem;
		}

		&.isNarrow .fm-leaflet-map-narrow-attribution.visible {
			opacity: 1;
			pointer-events: auto;
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

		.fm-leaflet-map-controls {
			position: absolute;
			inset: calc(var(--fm-leaflet-map-inset-top, 0px) + 10px) auto auto calc(var(--facilmap-inset-left, 0px) + 10px);
		}

		&.isNarrow .fm-leaflet-map-controls {
			inset: auto calc(var(--facilmap-inset-right, 0px) + 10px) calc(var(--fm-leaflet-map-inset-bottom, 0px) + 10px) auto;
		}


		.fm-leaflet-map-spinner {
			position:absolute;
			bottom: 20px;
			left: 115px;
			color: #00272a;
		}

		.fm-logo {
			position: absolute;
			bottom: calc(var(--fm-leaflet-map-inset-bottom, 0px) + 15px);
			left: calc(var(--facilmap-inset-left, 0px) + 15px);
		}

	}
</style>