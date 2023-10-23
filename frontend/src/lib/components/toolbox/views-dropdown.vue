<script setup lang="ts">
	import { displayView } from "facilmap-leaflet";
	import { View } from "facilmap-types";
	// import SaveView from "../save-view/save-view.vue";
	// import ManageViews from "../manage-views/manage-views.vue";
	import { injectClientRequired } from "../client-context.vue";
	import { ref } from "vue";
	import { injectMapContextRequired } from "../leaflet-map/leaflet-map.vue";

	const client = injectClientRequired();
	const mapContext = injectMapContextRequired();

	const emit = defineEmits<{
		(type: "hide-sidebar"): void;
	}>();

	const dialog = ref<
		| "save-view"
		| "manage-views"
	>();

	function doDisplayView(view: View): void {
		displayView(mapContext.components.map, view, { overpassLayer: mapContext.components.overpassLayer });
	}
</script>

<template>
	<li class="nav-item dropdown">
		<a
			class="nav-link dropdown-toggle"
			href="javascript:"
			data-bs-toggle="dropdown"
		>Views</a>
		<ul class="dropdown-menu dropdown-menu-end">
			<li v-for="view in client.views">
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
		</ul>
	</li>

	<!-- <SaveView
		v-if="dialog === 'save-view' && client.padData"
		@hidden="dialog = undefined"
	></SaveView>

	<ManageViews
		v-if="dialog === 'manage-views' && client.padData"
		@hidden="dialog = undefined"
	></ManageViews> -->
</template>