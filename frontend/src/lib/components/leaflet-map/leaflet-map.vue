<script setup lang="ts">
	import { type Ref, computed, onMounted, ref } from "vue";
	import { useMapContext } from "./leaflet-map-components";
	import vTooltip from "../../utils/tooltip";
	import type { WritableMapContext } from "../facil-map-context-provider/map-context";
	import { injectContextRequired, requireClientContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { useI18n, vReplaceLinks } from "../../utils/i18n";
	import AboutDialog from "../about-dialog.vue";
	import { markdownInline, quoteMarkdown } from "facilmap-utils";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const i18n = useI18n();

	const innerContainerRef = ref<HTMLElement>();
	const mapRef = ref<HTMLElement>();

	const loaded = ref(false);
	const fatalError = ref<string>();
	const showNarrowAttribution = ref(true);
	const aboutDialogOpen = ref(false);

	const selfUrl = computed(() => {
		return `${location.origin}${location.pathname}${mapContext.value?.hash ? `#${mapContext.value.hash}` : ''}`;
	});

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
	<div class="fm-leaflet-map-container" :class="{ isNarrow: context.isNarrow }">
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

				<a
					v-if="context.settings.linkLogo"
					:href="selfUrl"
					target="_blank"
					class="fm-open-external"
					v-tooltip.right="i18n.t('leaflet-map.open-full-size', { appName: context.appName })"
				></a>
				<div class="fm-logo">
					<img src="./logo.png"/>
				</div>

				<div class="spinner-border fm-leaflet-map-spinner" v-show="client.loading > 0 || (mapContext && mapContext.loading > 0)"></div>

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
				width: 100%;

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

				.label {
					color: #000;
					text-shadow: 0 0 3px #fff, 0 0 5px #fff, 0 0 10px #fff;
				}
			}

			.leaflet-control-locate.leaflet-control-locate {
				a, a > span {
					font-size: inherit;
					display: inline-flex;
					align-items: center;
					justify-content: center;
				}

				&.active a {
					color: rgb(32, 116, 182);
				}

				&.following a {
					color: rgb(252, 132, 40);
				}
			}

			.leaflet-control-attribution.leaflet-control-attribution {
				.fm-donate {
					color: #ff00f6;
					font-weight: bold;
				}
			}

			path.leaflet-interactive {
				// Do not show focus ring
				outline: none;
			}

		}

		&.isNarrow {
			.leaflet-control-locate {
				float: none;
				position: absolute;
				bottom: 0px;
				right: 44px;
			}

			.leaflet-control-zoom {
				border: none;

				.leaflet-control-zoom-in {
					margin-bottom: 10px;
				}

				.leaflet-control-zoom-in,.leaflet-control-zoom-out {
					border: 2px solid rgba(0,0,0,0.2);
					width: 34px;
					height: 34px;
					border-radius: 4px;
					background-clip: padding-box;
				}
			}

			.leaflet-control.leaflet-control-graphicscale {
				opacity: 0.6;
			}
		}

		.fm-leaflet-map-narrow-attribution {
			position: absolute;
			top: 0;
			left: 0;
			max-width: calc(100% - 54px);
			opacity: 0;
			transition: opacity 1s;

			// Style like attribution control
			background: rgba(255, 255, 255, 0.8);
			padding: 0 5px;
			color: #333;
			line-height: 1.4;
			font-size: 0.75rem;
		}

		&.isNarrow .fm-leaflet-map-narrow-attribution.visible {
			opacity: 1;
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