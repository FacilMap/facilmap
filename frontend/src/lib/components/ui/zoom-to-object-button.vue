<script setup lang="ts">
	import { computed } from "vue";
	import type { ButtonSize } from "../../utils/bootstrap";
	import { flyTo, type ZoomDestination } from "../../utils/zoom";
	import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import Icon from "./icon.vue";
	import vTooltip from "../../utils/tooltip";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const props = withDefaults(defineProps<{
		destination: ZoomDestination;
		size?: ButtonSize;
		label?: string;
	}>(), {
		label: "object"
	});

	const tooltip = computed(() => props.label ?? i18n.t("zoom-to-object-button.fallback-label"));

	function zoom(): void {
		flyTo(mapContext.value.components.map, props.destination);
	}
</script>

<template>
	<button
		type="button"
		class="btn btn-secondary btn-sm"
		v-tooltip="tooltip"
		@click="zoom()"
	>
		<Icon icon="zoom-in" :alt="tooltip"></Icon>
	</button>
</template>