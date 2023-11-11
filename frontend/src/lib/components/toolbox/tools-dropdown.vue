<script setup lang="ts">
	import PadSettingsDialog from "../pad-settings-dialog/pad-settings-dialog.vue";
	import EditFilterDialog from "../edit-filter-dialog.vue";
	import HistoryDialog from "../history-dialog/history-dialog.vue";
	import ShareDialog from "../share-dialog.vue";
	import { computed, ref, toRef } from "vue";
	import vTooltip from "../../utils/tooltip";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);
	const importTabContext = toRef(() => context.components.importTab);

	const props = defineProps<{
		interactive: boolean;
	}>();

	const emit = defineEmits<{
		"hide-sidebar": [];
	}>();

	const dialog = ref<
		| "edit-pad"
		| "share"
		| "edit-filter"
		| "history"
	>();

	const filterQuery = computed(() => {
		const v = mapContext.value;
		if (v.filter) {
			return {
				q: `?filter=${encodeURIComponent(v.filter)}`,
				a: `&filter=${encodeURIComponent(v.filter)}`
			};
		} else {
			return { q: "", a: "" };
		}
	});
</script>

<template>
	<DropdownMenu
		tag="li"
		class="nav-item"
		isLink
		buttonClass="nav-link"
		menuClass="dropdown-menu-end"
		label="Tools"
	>
		<li v-if="props.interactive">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'share'; emit('hide-sidebar')"
			>Share</a>
		</li>

		<li v-if="props.interactive && importTabContext">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="importTabContext.openFilePicker(); emit('hide-sidebar')"
			>Open file</a>
		</li>

		<li v-if="client.padData">
			<a
				class="dropdown-item"
				:href="`${client.padData.id}/geojson${filterQuery.q}`"
				target="_blank"
				v-tooltip.left="'GeoJSON files store all map information and can thus be used for map backups and be re-imported without any loss.'"
			>Export as GeoJSON</a>
		</li>

		<li v-if="client.padData">
			<a
				class="dropdown-item"
				:href="`${client.padData.id}/gpx?useTracks=1${filterQuery.a}`"
				target="_blank"
				v-tooltip.left="'GPX files can be opened with most navigation software. In track mode, any calculated routes are saved in the file.'"
			>Export as GPX (tracks)</a>
		</li>

		<li v-if="client.padData">
			<a
				class="dropdown-item"
				:href="`${client.padData.id}/gpx?useTracks=0${filterQuery.a}`"
				target="_blank"
				v-tooltip.left="'GPX files can be opened with most navigation software. In route mode, only the start/end/via points are saved in the file, and the navigation software needs to recalculate the routes.'"
			>Export as GPX (routes)</a>
		</li>

		<li v-if="client.padData">
			<a
				class="dropdown-item"
				:href="`${client.padData.id}/table${filterQuery.q}`"
				target="_blank"
			>Export as table</a>
		</li>

		<li v-if="client.padData">
			<hr class="dropdown-divider">
		</li>

		<li v-if="client.padData">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'edit-filter'; emit('hide-sidebar')"
			>Filter</a>
		</li>

		<li v-if="client.writable == 2 && client.padData">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'edit-pad'; emit('hide-sidebar')"
			>Settings</a>
		</li>

		<li v-if="!client.readonly && client.padData">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'history'; emit('hide-sidebar')"
			>Show edit history</a>
		</li>
	</DropdownMenu>

	<PadSettingsDialog
		v-if="dialog === 'edit-pad' && client.padData"
		@hidden="dialog = undefined"
	></PadSettingsDialog>

	<ShareDialog
		v-if="dialog === 'share'"
		@hidden="dialog = undefined"
	></ShareDialog>

	<EditFilterDialog
		v-if="dialog === 'edit-filter' && client.padData"
		@hidden="dialog = undefined"
	></EditFilterDialog>

	<HistoryDialog
		v-if="dialog === 'history' && client.padData"
		@hidden="dialog = undefined"
	></HistoryDialog>
</template>