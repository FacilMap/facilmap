<script lang="ts">
	import { computed, ref } from "vue";
	import type { ButtonSize } from "../../utils/bootstrap";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import DropdownMenu from "./dropdown-menu.vue";
	import { useToasts } from "./toasts/toasts.vue";
	import { saveAs } from "file-saver";
	import vTooltip from "../../utils/tooltip";
	import { concatArrayBuffers } from "facilmap-utils";
	import { useI18n } from "../../utils/i18n";
	import { streamToArray } from "json-stream-es";
import type { ExportResult } from "facilmap-types";

	const exportFormats = ["gpx-trk", "gpx-rte", "geojson"] as const;
	export type ExportFormat = typeof exportFormats[number];
</script>

<script setup lang="ts" generic="F extends ExportFormat = ExportFormat">
	const context = injectContextRequired();
	const toasts = useToasts();
	const i18n = useI18n();

	const props = defineProps<{
		formats?: F[];
		getExport: (format: NoInfer<F>) => Promise<ExportResult>;
		isDisabled?: boolean;
		size?: ButtonSize;
	}>();

	const isExporting = ref(false);

	const formats = computed(() => props.formats as ExportFormat[] ?? exportFormats);

	async function doExport(format: ExportFormat): Promise<void> {
		toasts.hideToast(`fm${context.id}-export-dropdown-error`);
		isExporting.value = true;

		try {
			const result = await props.getExport(format as F);
			const content = concatArrayBuffers(await streamToArray(result.data));
			saveAs(new Blob([content], { type: result.type }), result.filename);
		} catch(err: any) {
			toasts.showErrorToast(`fm${context.id}-export-dropdown-error`, () => i18n.t("export-dropdown.export-error"), err);
		} finally {
			isExporting.value = false;
		}
	}
</script>

<template>
	<DropdownMenu
		:size="props.size"
		:isDisabled="props.isDisabled"
		:label="i18n.t('export-dropdown.button-label')"
		:isBusy="isExporting"
	>
		<li v-if="formats.includes('gpx-trk')">
			<a
				href="javascript:"
				class="dropdown-item"
				@click="doExport('gpx-trk')"
				v-tooltip.right="i18n.t('export-dropdown.gpx-track-tooltip')"
			>{{i18n.t("export-dropdown.gpx-track-label")}}</a>
		</li>
		<li v-if="formats.includes('gpx-rte')">
			<a
				href="javascript:"
				class="dropdown-item"
				@click="doExport('gpx-rte')"
				v-tooltip.right="i18n.t('export-dropdown.gpx-route-tooltip')"
			>{{i18n.t("export-dropdown.gpx-route-label")}}</a>
		</li>
		<li v-if="formats.includes('geojson')">
			<a
				href="javascript:"
				class="dropdown-item"
				@click="doExport('geojson')"
				v-tooltip.right="i18n.t('export-dropdown.geojson-tooltip')"
			>{{i18n.t("export-dropdown.geojson-label")}}</a>
		</li>
	</DropdownMenu>
</template>