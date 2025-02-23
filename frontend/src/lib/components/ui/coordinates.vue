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
	import { getExternalLinks } from "../../utils/external-links";

	const context = injectContextRequired();
	const toasts = useToasts();
	const i18n = useI18n();

	const props = defineProps<{
		point: Point;
		zoom?: number;
		ele?: number | null;
	}>();

	const formattedCoordinates = computed(() => formatCoordinates(props.point));
	const degrees = computed(() => formatCoordinateDegrees(props.point));
	const geo = computed(() => `geo:${props.point.lat.toFixed(5)},${props.point.lon.toFixed(5)}${props.zoom != null ? `?z=${props.zoom}` : ""}`);

	const externalLinks = computed(() => getExternalLinks({ ...props.point, zoom: props.zoom }, "marker", context.hideCommercialMapLinks));

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
					@click="copy(degrees)"
					v-tooltip="i18n.t('coordinates.copy-to-clipboard')"
					draggable="false"
				>
					<span>{{degrees}}</span>
					<Icon icon="copy" :alt="i18n.t('coordinates.copy-to-clipboard')"></Icon>
				</a>
			</li>

			<li>
				<a
					href="javascript:"
					class="dropdown-item"
					@click="copy(geo)"
					v-tooltip="i18n.t('coordinates.copy-to-clipboard')"
					draggable="false"
				>
					<span>{{geo}}</span>
					<Icon icon="copy" :alt="i18n.t('coordinates.copy-to-clipboard')"></Icon>
				</a>
			</li>

			<li><hr class="dropdown-divider"></li>

			<li v-for="link in externalLinks" :key="link.key">
				<a
					class="dropdown-item"
					:href="link.href"
					:target="link.target"
					draggable="false"
				>
					<span>{{link.label}}</span>
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