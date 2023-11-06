<script setup lang="ts">
	import { displayView } from "facilmap-leaflet";
	import type { View } from "facilmap-types";
	import SaveViewDialog from "../save-view-dialog.vue";
	import ManageViewsDialog from "../manage-views-dialog.vue";
	import { ref } from "vue";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);

	const emit = defineEmits<{
		"hide-sidebar": [];
	}>();

	const dialog = ref<
		| "save-view"
		| "manage-views"
	>();

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
		label="Views"
	>
		<li v-for="view in client.views" :key="view.id">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="doDisplayView(view); emit('hide-sidebar')"
			>{{view.name}}</a>
		</li>

		<li v-if="client.writable == 2 && Object.keys(client.views).length > 0">
			<hr class="dropdown-divider">
		</li>

		<li v-if="client.writable == 2">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'save-view'; emit('hide-sidebar')"
			>Save current view</a>
		</li>

		<li v-if="client.writable == 2 && Object.keys(client.views).length > 0">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'manage-views'; emit('hide-sidebar')"
			>Manage views</a>
		</li>
	</DropdownMenu>

	<SaveViewDialog
		v-if="dialog === 'save-view' && client.padData"
		@hidden="dialog = undefined"
	></SaveViewDialog>

	<ManageViewsDialog
		v-if="dialog === 'manage-views' && client.padData"
		@hidden="dialog = undefined"
	></ManageViewsDialog>
</template>