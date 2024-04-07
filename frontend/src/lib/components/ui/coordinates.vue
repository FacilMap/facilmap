<script setup lang="ts">
	import type { Point } from "facilmap-types";
	import copyToClipboard from "copy-to-clipboard";
	import { formatCoordinates, formatElevation } from "facilmap-utils";
	import Icon from "./icon.vue";
	import { computed } from "vue";
	import { useToasts } from "./toasts/toasts.vue";
	import vTooltip from "../../utils/tooltip";
	import { useI18n } from "../../utils/i18n";

	const toasts = useToasts();
	const i18n = useI18n();

	const props = defineProps<{
		point: Point;
		ele?: number | null;
	}>();

	const formattedCoordinates = computed(() => formatCoordinates(props.point));

	function copy(): void {
		copyToClipboard(formattedCoordinates.value);
		toasts.showToast(undefined, i18n.t("coordinates.copied-title"), i18n.t("coordinates.copied-message"), { variant: "success", autoHide: true });
	}
</script>

<template>
	<span class="fm-coordinates">
		<span>{{formattedCoordinates}}</span>
		<button
			type="button"
			class="btn btn-secondary"
			@click="copy()"
			v-tooltip="i18n.t('coordinates.copy-to-clipboard')"
		>
			<Icon icon="copy" :alt="i18n.t('coordinates.copy-to-clipboard')"></Icon>
		</button>
		<span v-if="props.ele != null" v-tooltip="i18n.t('coordinates.elevation')">
			({{formatElevation(props.ele)}})
		</span>
	</span>
</template>

<style lang="scss">
	.fm-coordinates {
		display: inline-flex;
		align-items: center;

		button, button + * {
			margin-left: 0.5rem;
		}

		button {
			padding: 0 0.25rem;
			line-height: 1;
			font-size: 0.85em;
			vertical-align: top;
		}
	}
</style>