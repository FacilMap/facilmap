<script setup lang="ts">
	import PadSettingsDialog from "../pad-settings-dialog/pad-settings-dialog.vue";
	import EditFilterDialog from "../edit-filter-dialog.vue";
	import HistoryDialog from "../history-dialog/history-dialog.vue";
	import ShareDialog from "../share-dialog.vue";
	import { ref, toRef } from "vue";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import { injectContextRequired, requireClientContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import ExportDialog from "../export-dialog.vue";
	import UserPreferencesDialog from "../user-preferences-dialog.vue";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const i18n = useI18n();
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

		<li v-if="client.padData">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'export'; emit('hide-sidebar')"
				draggable="false"
			>{{i18n.t("toolbox-tools-dropdown.export")}}</a>
		</li>

		<li v-if="client.padData">
			<hr class="dropdown-divider">
		</li>

		<li v-if="client.padData">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'edit-filter'; emit('hide-sidebar')"
				draggable="false"
			>{{i18n.t("toolbox-tools-dropdown.filter")}}</a>
		</li>

		<li v-if="client.writable == 2 && client.padData">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'edit-pad'; emit('hide-sidebar')"
				draggable="false"
			>{{i18n.t("toolbox-tools-dropdown.settings")}}</a>
		</li>

		<li v-if="!client.readonly && client.padData">
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

	<PadSettingsDialog
		v-if="dialog === 'edit-pad' && client.padData"
		@hidden="dialog = undefined"
	></PadSettingsDialog>

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
		v-if="dialog === 'edit-filter' && client.padData"
		@hidden="dialog = undefined"
	></EditFilterDialog>

	<HistoryDialog
		v-if="dialog === 'history' && client.padData"
		@hidden="dialog = undefined"
	></HistoryDialog>

	<UserPreferencesDialog
		v-if="dialog === 'user-preferences'"
		@hidden="dialog = undefined"
	></UserPreferencesDialog>
</template>