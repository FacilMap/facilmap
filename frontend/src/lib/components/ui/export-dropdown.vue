<script setup lang="ts" generic="F extends ExportFormat = ExportFormat">
	import { computed, ref } from "vue";
	import type { ButtonSize } from "../../utils/bootstrap";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import DropdownMenu from "./dropdown-menu.vue";
	import { exportFormatValidator, type ExportFormat } from "facilmap-types";
	import { useToasts } from "./toasts/toasts.vue";
	import { saveAs } from "file-saver";
	import vTooltip from "../../utils/tooltip";
	import { getSafeFilename } from "facilmap-utils";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const toasts = useToasts();
	const i18n = useI18n();

	const props = defineProps<{
		filename: string;
		formats?: F[];
		getExport: (format: NoInfer<F>) => Promise<string>;
		isDisabled?: boolean;
		size?: ButtonSize;
	}>();

	const isExporting = ref(false);

	const formats = computed(() => props.formats as ExportFormat[] ?? exportFormatValidator.options);

	async function doExport(format: ExportFormat): Promise<void> {
		toasts.hideToast(`fm${context.id}-export-dropdown-error`);
		isExporting.value = true;

		try {
			const exported = await props.getExport(format as F);
			saveAs(new Blob([exported], { type: "application/gpx+xml" }), `${getSafeFilename(props.filename)}.gpx`);
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