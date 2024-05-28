<script setup lang="ts">
	import { displayView } from "facilmap-leaflet";
	import { Writable, type DeepReadonly, type View } from "facilmap-types";
	import SaveViewDialog from "../save-view-dialog.vue";
	import ManageViewsDialog from "../manage-views-dialog.vue";
	import { computed, ref } from "vue";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { getOrderedViews } from "facilmap-utils";
	import { useI18n } from "../../utils/i18n";
	import { ClientContextMapState } from "../facil-map-context-provider/client-context";

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

	const orderedViews = computed(() => getOrderedViews(client.value.map?.data?.views ?? {}));

	function doDisplayView(view: DeepReadonly<View>): void {
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

		<template v-if="client.map?.data?.mapData?.writable == Writable.ADMIN">
			<li v-if="orderedViews.length > 0">
				<hr class="dropdown-divider">
			</li>

			<li>
				<a
					class="dropdown-item"
					href="javascript:"
					@click="dialog = 'save-view'; emit('hide-sidebar')"
					draggable="false"
				>{{i18n.t("toolbox-views-dropdown.save-current-view")}}</a>
			</li>

			<li v-if="orderedViews.length > 0">
				<a
					class="dropdown-item"
					href="javascript:"
					@click="dialog = 'manage-views'; emit('hide-sidebar')"
					draggable="false"
				>{{i18n.t("toolbox-views-dropdown.manage-views")}}</a>
			</li>
		</template>
	</DropdownMenu>

	<SaveViewDialog
		v-if="dialog === 'save-view' && client.map?.state === ClientContextMapState.OPEN"
		@hidden="dialog = undefined"
	></SaveViewDialog>

	<ManageViewsDialog
		v-if="dialog === 'manage-views' && client.map?.state === ClientContextMapState.OPEN"
		@hidden="dialog = undefined"
	></ManageViewsDialog>
</template>