<script setup lang="ts">
	import PadSettingsDialog from "../pad-settings-dialog/pad-settings-dialog.vue";
	import storage from "../../utils/storage";
	import ManageBookmarksDialog from "../manage-bookmarks-dialog.vue";
	import OpenMapDialog from "../open-map-dialog.vue";
	import { computed, ref } from "vue";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { normalizePadName } from "facilmap-utils";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const emit = defineEmits<{
		"hide-sidebar": [];
	}>();

	const dialog = ref<
		| "open-map"
		| "manage-bookmarks"
		| "create-pad"
	>();

	const hash = computed(() => {
		const v = mapContext.value;
		return v.hash && v.hash != "#" ? v.hash : `${v.zoom}/${v.center.lat}/${v.center.lng}`;
	});

	const isBookmarked = computed(() => {
		return !!client.value.padId && storage.bookmarks.some((bookmark) => bookmark.id == client.value.padId);
	});

	function addBookmark(): void {
		storage.bookmarks.push({ id: client.value.padId!, padId: client.value.padData!.id, name: client.value.padData!.name });
	}
</script>

<template>
	<DropdownMenu
		tag="li"
		class="nav-item"
		isLink
		:isDisabled="mapContext.interaction"
		buttonClass="nav-link"
		menuClass="dropdown-menu-end"
		:label="i18n.t('toolbox-collab-maps-dropdown.label')"
	>
		<li v-for="bookmark in storage.bookmarks" :key="bookmark.id">
			<a
				class="dropdown-item"
				:class="{ active: bookmark.id == client.padId }"
				:href="`${context.baseUrl}${encodeURIComponent(bookmark.id)}#${hash}`"
				@click.exact.prevent="client.openPad(bookmark.id); emit('hide-sidebar')"
				draggable="false"
			>{{bookmark.customName || normalizePadName(bookmark.name)}}</a>
		</li>

		<li v-if="storage.bookmarks.length > 0">
			<hr class="dropdown-divider">
		</li>

		<li v-if="client.padData && !isBookmarked">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="addBookmark()"
				draggable="false"
			>{{i18n.t('toolbox-collab-maps-dropdown.bookmark', { padName: normalizePadName(client.padData.name) })}}</a>
		</li>

		<li v-if="storage.bookmarks.length > 0">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'manage-bookmarks'; emit('hide-sidebar')"
				draggable="false"
			>{{i18n.t('toolbox-collab-maps-dropdown.manage-bookmarks')}}</a>
		</li>

		<li v-if="(client.padData && !isBookmarked) || storage.bookmarks.length > 0">
			<hr class="dropdown-divider">
		</li>

		<li v-if="!client.padId">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'create-pad'; emit('hide-sidebar')"
				draggable="false"
			>{{i18n.t('toolbox-collab-maps-dropdown.create-map')}}</a>
		</li>

		<li>
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'open-map'; emit('hide-sidebar')"
				draggable="false"
			>{{client.padId ? i18n.t("toolbox-collab-maps-dropdown.open-other-map") : i18n.t("toolbox-collab-maps-dropdown.open-map")}}</a>
		</li>

		<li v-if="client.padData">
			<a
				class="dropdown-item"
				:href="`${context.baseUrl}#${hash}`"
				@click.exact.prevent="client.openPad(undefined)"
				draggable="false"
			>{{i18n.t("toolbox-collab-maps-dropdown.close-map", { padName: client.padData.name })}}</a>
		</li>
	</DropdownMenu>

	<OpenMapDialog
		v-if="dialog === 'open-map'"
		@hidden="dialog = undefined"
	></OpenMapDialog>

	<ManageBookmarksDialog
		v-if="dialog === 'manage-bookmarks'"
		@hidden="dialog = undefined"
	></ManageBookmarksDialog>

	<PadSettingsDialog
		v-if="dialog === 'create-pad'"
		@hidden="dialog = undefined"
		:isCreate="true"
	></PadSettingsDialog>
</template>