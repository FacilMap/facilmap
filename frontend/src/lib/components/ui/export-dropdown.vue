<script setup lang="ts">
	import { ref } from "vue";
	import type { ButtonSize } from "../../utils/bootstrap";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import DropdownMenu from "./dropdown-menu.vue";
	import type { ExportFormat } from "facilmap-types";
	import { useToasts } from "./toasts/toasts.vue";
	import { saveAs } from "file-saver";
	import vTooltip from "../../utils/tooltip";

	const context = injectContextRequired();
	const toasts = useToasts();

	const props = defineProps<{
		filename: string;
		getExport: (format: ExportFormat) => Promise<string>;
		isDisabled?: boolean;
		size?: ButtonSize;
	}>();

	const isExporting = ref(false);

	async function exportRoute(format: ExportFormat): Promise<void> {
		toasts.hideToast(`fm${context.id}-export-dropdown-error`);
		isExporting.value = true;

		try {
			const exported = await props.getExport(format);
			saveAs(new Blob([exported], { type: "application/gpx+xml" }), `${props.filename}.gpx`);
		} catch(err: any) {
			toasts.showErrorToast(`fm${context.id}-export-dropdown-error`, "Error exporting route", err);
		} finally {
			isExporting.value = false;
		}
	}
</script>

<template>
	<DropdownMenu
		:size="props.size"
		:isDisabled="props.isDisabled"
		label="Export"
		:isBusy="isExporting"
	>
	<li>
		<a
			href="javascript:"
			class="dropdown-item"
			@click="exportRoute('gpx-trk')"
			v-tooltip.right="'GPX files can be opened with most navigation software. In track mode, the calculated route is saved in the file.'"
		>Export as GPX track</a>
	</li>
	<li>
		<a
			href="javascript:"
			class="dropdown-item"
			@click="exportRoute('gpx-rte')"
			v-tooltip.right="'GPX files can be opened with most navigation software. In route mode, only the start/end/via points are saved in the file, and the navigation software needs to calculate the route.'"
		>Export as GPX route</a>
	</li>
	</DropdownMenu>
</template>