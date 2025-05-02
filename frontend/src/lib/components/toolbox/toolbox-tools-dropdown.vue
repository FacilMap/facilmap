<script setup lang="ts">
	import MapSettingsDialog from "../map-settings-dialog/map-settings-dialog.vue";
	import EditFilterDialog from "../edit-filter-dialog.vue";
	import HistoryDialog from "../history-dialog/history-dialog.vue";
	import ShareDialog from "../share-dialog.vue";
	import { ref, toRef } from "vue";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import { getClientSub, injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import ExportDialog from "../export-dialog.vue";
	import UserPreferencesDialog from "../user-preferences-dialog/user-preferences-dialog.vue";
	import { useI18n } from "../../utils/i18n";
	import { canConfigureMap } from "facilmap-utils";

	const context = injectContextRequired();
	const clientSub = getClientSub(context);
	const i18n = useI18n();
	const importTabContext = toRef(() => context.components.importTab);

	const props = defineProps<{
		interactive: boolean;
	}>();

	const emit = defineEmits<{
		"hide-sidebar": [];
	}>();

	const dialog = ref<
		| "edit-map"
		| "share"
		| "export"
		| "edit-filter"
		| "history"
		| "user-preferences"
	>();
</script>

<template>
	<DropdownMenu
		tag="li"
		class="nav-item"
		isLink
		buttonClass="nav-link"
		menuClass="dropdown-menu-end"
		:label="i18n.t('toolbox-tools-dropdown.label')"
	>
		<li v-if="props.interactive">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'share'; emit('hide-sidebar')"
				draggable="false"
			>{{i18n.t("toolbox-tools-dropdown.share")}}</a>
		</li>

		<li v-if="props.interactive && importTabContext">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="importTabContext.openFilePicker(); emit('hide-sidebar')"
				draggable="false"
			>{{i18n.t("toolbox-tools-dropdown.open-file")}}</a>
		</li>

		<li v-if="clientSub">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'export'; emit('hide-sidebar')"
				draggable="false"
			>{{i18n.t("toolbox-tools-dropdown.export")}}</a>
		</li>

		<li v-if="clientSub">
			<hr class="dropdown-divider">
		</li>

		<li v-if="clientSub">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'edit-filter'; emit('hide-sidebar')"
				draggable="false"
			>{{i18n.t("toolbox-tools-dropdown.filter")}}</a>
		</li>

		<li v-if="clientSub && canConfigureMap(clientSub.activeLink.permissions)">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'edit-map'; emit('hide-sidebar')"
				draggable="false"
			>{{i18n.t("toolbox-tools-dropdown.settings")}}</a>
		</li>

		<li v-if="clientSub">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'history'; emit('hide-sidebar')"
				draggable="false"
			>{{i18n.t("toolbox-tools-dropdown.history")}}</a>
		</li>

		<li>
			<hr class="dropdown-divider">
		</li>

		<li>
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'user-preferences'; emit('hide-sidebar')"
				draggable="false"
			>{{i18n.t("toolbox-tools-dropdown.user-preferences")}}</a>
		</li>
	</DropdownMenu>

	<MapSettingsDialog
		v-if="dialog === 'edit-map' && clientSub"
		@hidden="dialog = undefined"
	></MapSettingsDialog>

	<ShareDialog
		v-if="dialog === 'share'"
		@hidden="dialog = undefined"
	></ShareDialog>

	<KeepAlive>
		<ExportDialog
			v-if="dialog === 'export'"
			@hidden="dialog = undefined"
		></ExportDialog>
	</KeepAlive>

	<EditFilterDialog
		v-if="dialog === 'edit-filter' && clientSub"
		@hidden="dialog = undefined"
	></EditFilterDialog>

	<HistoryDialog
		v-if="dialog === 'history' && clientSub"
		@hidden="dialog = undefined"
	></HistoryDialog>

	<UserPreferencesDialog
		v-if="dialog === 'user-preferences'"
		@hidden="dialog = undefined"
	></UserPreferencesDialog>
</template>