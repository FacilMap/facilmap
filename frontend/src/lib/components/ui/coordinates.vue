<script setup lang="ts">
	import type { Point } from "facilmap-types";
	import copyToClipboard from "copy-to-clipboard";
	import { formatCoordinateDegrees, formatCoordinates, formatElevation } from "facilmap-utils";
	import Icon from "./icon.vue";
	import { computed } from "vue";
	import { useToasts } from "./toasts/toasts.vue";
	import vTooltip from "../../utils/tooltip";
	import { useI18n } from "../../utils/i18n";
	import DropdownMenu from "./dropdown-menu.vue";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";

	const context = injectContextRequired();
	const toasts = useToasts();
	const i18n = useI18n();

	const props = defineProps<{
		point: Point;
		zoom?: number;
		ele?: number | null;
	}>();

	const formattedCoordinates = computed(() => formatCoordinates(props.point));

	const links = computed(() => {
		const lat = props.point.lat.toFixed(5);
		const lon = props.point.lon.toFixed(5);
		return {
			degrees: formatCoordinateDegrees(props.point),
			geo: `geo:${lat},${lon}${props.zoom != null ? `?z=${props.zoom}` : ""}`,
			osm: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=${props.zoom ?? 12}/${lat}/${lon}`,
			google: `https://maps.google.com/maps?t=m&q=loc:${lat},${lon}`,
			googleSatellite: `https://maps.google.com/maps?t=k&q=loc:${lat},${lon}`,
			bing: `https://www.bing.com/maps?q=${lat},${lon}`,
			bingSatellite: `https://www.bing.com/maps?q=${lat},${lon}&style=h`
		};
	});

	function copy(coordinates: string): void {
		copyToClipboard(coordinates);
		toasts.showToast(undefined, () => i18n.t("coordinates.copied-title"), () => i18n.t("coordinates.copied-message"), { variant: "success", autoHide: true });
	}
</script>

<template>
	<span class="fm-coordinates">
		<span>{{formattedCoordinates}}</span>

		<DropdownMenu>
			<li>
				<a
					href="javascript:"
					class="dropdown-item"
					@click="copy(formattedCoordinates)"
					v-tooltip="i18n.t('coordinates.copy-to-clipboard')"
					draggable="false"
				>
					<span>{{formattedCoordinates}}</span>
					<Icon icon="copy" :alt="i18n.t('coordinates.copy-to-clipboard')"></Icon>
				</a>
			</li>

			<li>
				<a
					href="javascript:"
					class="dropdown-item"
					@click="copy(links.degrees)"
					v-tooltip="i18n.t('coordinates.copy-to-clipboard')"
					draggable="false"
				>
					<span>{{links.degrees}}</span>
					<Icon icon="copy" :alt="i18n.t('coordinates.copy-to-clipboard')"></Icon>
				</a>
			</li>

			<li>
				<a
					href="javascript:"
					class="dropdown-item"
					@click="copy(links.geo)"
					v-tooltip="i18n.t('coordinates.copy-to-clipboard')"
					draggable="false"
				>
					<span>{{links.geo}}</span>
					<Icon icon="copy" :alt="i18n.t('coordinates.copy-to-clipboard')"></Icon>
				</a>
			</li>

			<li><hr class="dropdown-divider"></li>

			<li>
				<a
					class="dropdown-item"
					:href="links.geo"
					draggable="false"
				>
					<span>{{i18n.t("links.geo-link")}}</span>
					<Icon icon="new-window"></Icon>
				</a>
			</li>

			<li>
				<a
					class="dropdown-item"
					:href="links.osm"
					target="_blank"
					draggable="false"
				>
					<span>{{i18n.t("links.openstreetmap")}}</span>
					<Icon icon="new-window"></Icon>
				</a>
			</li>

			<li v-if="!context.hideCommercialMapLinks">
				<a
					class="dropdown-item"
					:href="links.google"
					target="_blank"
					draggable="false"
				>
					<span>{{i18n.t("links.google-maps")}}</span>
					<Icon icon="new-window"></Icon>
				</a>
			</li>

			<li v-if="!context.hideCommercialMapLinks">
				<a
					class="dropdown-item"
					:href="links.googleSatellite"
					target="_blank"
					draggable="false"
				>
					<span>{{i18n.t("links.google-maps-satellite")}}</span>
					<Icon icon="new-window"></Icon>
				</a>
			</li>

			<li v-if="!context.hideCommercialMapLinks">
				<a
					class="dropdown-item"
					:href="links.bing"
					target="_blank"
					draggable="false"
				>
					<span>{{i18n.t("links.bing-maps")}}</span>
					<Icon icon="new-window"></Icon>
				</a>
			</li>

			<li v-if="!context.hideCommercialMapLinks">
				<a
					class="dropdown-item"
					:href="links.bingSatellite"
					target="_blank"
					draggable="false"
				>
					<span>{{i18n.t("links.bing-maps-satellite")}}</span>
					<Icon icon="new-window"></Icon>
				</a>
			</li>
		</DropdownMenu>

		<span v-if="props.ele != null" v-tooltip="i18n.t('coordinates.elevation')">
			({{formatElevation(props.ele)}})
		</span>
	</span>
</template>

<style lang="scss">
	.fm-coordinates {
		&, .dropdown {
			display: inline-flex;
			align-items: center;
		}

		.dropdown {
			margin-left: 0.3rem;
		}

		.dropdown + * {
			margin-left: 0.5rem;
		}

		.dropdown-toggle {
			padding: 0 0.4rem;
		}

		.dropdown-item {
			display: flex;
			align-items: center;

			> span:nth-child(1) {
				flex-grow: 1;
			}

			> span:nth-child(2) {
				display: inline-flex;
				margin-left: 0.5rem;
			}
		}
	}
</style>