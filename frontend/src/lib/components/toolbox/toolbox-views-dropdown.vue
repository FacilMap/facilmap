<script setup lang="ts">
	import { displayView } from "facilmap-leaflet";
	import type { View } from "facilmap-types";
	import SaveViewDialog from "../save-view-dialog.vue";
	import ManageViewsDialog from "../manage-views-dialog.vue";
	import { computed, ref } from "vue";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { getOrderedViews } from "facilmap-utils";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const emit = defineEmits<{
		"hide-sidebar": [];
	}>();

	const dialog = ref<
		| "save-view"
		| "manage-views"
	>();

	const orderedViews = computed(() => getOrderedViews(client.value.views));

	function doDisplayView(view: View): void {
		displayView(mapContext.value.components.map, view, { overpassLayer: mapContext.value.components.overpassLayer });
	}
</script>

<template>
	<DropdownMenu
		tag="li"
		class="nav-item"
		isLink
		buttonClass="nav-link"
		menuClass="dropdown-menu-end"
		:label="i18n.t('toolbox-views-dropdown.label')"
	>
		<li v-for="view in orderedViews" :key="view.id">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="doDisplayView(view); emit('hide-sidebar')"
				draggable="false"
			>{{view.name}}</a>
		</li>

		<li v-if="client.writable == 2 && orderedViews.length > 0">
			<hr class="dropdown-divider">
		</li>

		<li v-if="client.writable == 2">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'save-view'; emit('hide-sidebar')"
				draggable="false"
			>{{i18n.t("toolbox-views-dropdown.save-current-view")}}</a>
		</li>

		<li v-if="client.writable == 2 && orderedViews.length > 0">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'manage-views'; emit('hide-sidebar')"
				draggable="false"
			>{{i18n.t("toolbox-views-dropdown.manage-views")}}</a>
		</li>
	</DropdownMenu>

	<SaveViewDialog
		v-if="dialog === 'save-view' && client.mapData"
		@hidden="dialog = undefined"
	></SaveViewDialog>

	<ManageViewsDialog
		v-if="dialog === 'manage-views' && client.mapData"
		@hidden="dialog = undefined"
	></ManageViewsDialog>
</template>