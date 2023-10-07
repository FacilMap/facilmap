<script setup lang="ts">
	// import PadSettings from "../pad-settings/pad-settings.vue";
	// import EditFilter from "../edit-filter/edit-filter.vue";
	// import History from "../history/history.vue";
	// import Share from "../share/share.vue";
	import { injectContextRequired } from "../../utils/context";
	import { injectClientRequired } from "../../utils/client";
	import { computed, ref } from "vue";
	import { injectMapContextRequired } from "../../utils/map-context";
	import vTooltip from "../../utils/tooltip";

	const context = injectContextRequired();
	const client = injectClientRequired();
	const mapContext = injectMapContextRequired();

	const props = defineProps<{
		interactive: boolean;
	}>();

	const emit = defineEmits<{
		(type: "hide-sidebar"): void;
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

	function importFile(): void {
		mapContext.value.emit("import-file");
	}
</script>

<template>
	<li class="nav-item dropdown">
		<a
			class="nav-link dropdown-toggle"
			href="javascript:"
			data-bs-toggle="dropdown"
		>Tools</a>
		<ul class="dropdown-menu dropdown-menu-end">
			<li v-if="props.interactive">
				<a
					class="dropdown-item"
					href="javascript:"
					@click="dialog = 'share'; emit('hide-sidebar')"
				>Share</a>
			</li>

			<li v-if="props.interactive">
				<a
					class="dropdown-item"
					href="javascript:"
					@click="importFile(); emit('hide-sidebar')"
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
		</ul>
	</li>

	<!-- <PadSettings
		v-if="dialog === 'edit-pad' && client.padData"
		@hidden="dialog = undefined"
		:id="`fm${context.id}-toolbox-edit-pad`"
	></PadSettings>

	<Share
		v-if="dialog === 'share'"
		@hidden="dialog = undefined"
		:id="`fm${context.id}-toolbox-share`"
	></Share>

	<EditFilter
		v-if="dialog === 'edit-filter' && client.padData"
		@hidden="dialog = undefined"
		:id="`fm${context.id}-toolbox-edit-filter`"
	></EditFilter>

	<History
		v-if="dialog === 'history' && client.padData"
		@hidden="dialog = undefined"
		:id="`fm${context.id}-toolbox-history`"
	></History> -->
</template>