<script setup lang="ts">
	import MapSettingsDialog from "../map-settings-dialog/map-settings-dialog.vue";
	import storage from "../../utils/storage";
	import ManageFavouritesDialog from "../manage-favourites-dialog.vue";
	import OpenMapDialog from "../open-map-dialog.vue";
	import { computed, ref } from "vue";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import { getClientSub, injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { normalizeMapName } from "facilmap-utils";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const clientContext = requireClientContext(context);
	const clientSub = getClientSub(context);
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const emit = defineEmits<{
		"hide-sidebar": [];
	}>();

	const dialog = ref<
		| "open-map"
		| "manage-favourites"
		| "create-map"
	>();

	const hash = computed(() => {
		const v = mapContext.value;
		return v.hash && v.hash != "#" ? v.hash : `${v.zoom}/${v.center.lat}/${v.center.lng}`;
	});

	const isFavourite = computed(() => {
		return !!clientSub.value && storage.favourites.some((favourite) => favourite.mapSlug == clientSub.value!.mapSlug);
	});

	function addFavourite(): void {
		storage.favourites.push({ mapSlug: clientSub.value!.mapSlug, mapId: clientSub.value!.data.mapData.id, name: clientSub.value!.data.mapData.name });
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
		<li v-for="favourite in storage.favourites" :key="favourite.mapSlug">
			<a
				class="dropdown-item"
				:class="{ active: clientSub && favourite.mapSlug == clientSub.mapSlug }"
				:href="`${context.baseUrl}${encodeURIComponent(favourite.mapSlug)}#${hash}`"
				@click.exact.prevent="clientContext.openMap(favourite.mapSlug); emit('hide-sidebar')"
				draggable="false"
			>{{favourite.customName || normalizeMapName(favourite.name)}}</a>
		</li>

		<li v-if="storage.favourites.length > 0">
			<hr class="dropdown-divider">
		</li>

		<li v-if="clientSub && !isFavourite">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="addFavourite()"
				draggable="false"
			>{{i18n.t('toolbox-collab-maps-dropdown.favourite', { mapName: normalizeMapName(clientSub.data.mapData.name) })}}</a>
		</li>

		<li v-if="storage.favourites.length > 0">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'manage-favourites'; emit('hide-sidebar')"
				draggable="false"
			>{{i18n.t('toolbox-collab-maps-dropdown.manage-favourites')}}</a>
		</li>

		<li v-if="(clientSub && !isFavourite) || storage.favourites.length > 0">
			<hr class="dropdown-divider">
		</li>

		<li v-if="!clientSub">
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'create-map'; emit('hide-sidebar')"
				draggable="false"
			>{{i18n.t('toolbox-collab-maps-dropdown.create-map')}}</a>
		</li>

		<li>
			<a
				class="dropdown-item"
				href="javascript:"
				@click="dialog = 'open-map'; emit('hide-sidebar')"
				draggable="false"
			>{{clientSub ? i18n.t("toolbox-collab-maps-dropdown.open-other-map") : i18n.t("toolbox-collab-maps-dropdown.open-map")}}</a>
		</li>

		<li v-if="clientSub">
			<a
				class="dropdown-item"
				:href="`${context.baseUrl}#${hash}`"
				@click.exact.prevent="clientContext.openMap(undefined)"
				draggable="false"
			>{{i18n.t("toolbox-collab-maps-dropdown.close-map", { mapName: normalizeMapName(clientSub.data.mapData.name) })}}</a>
		</li>
	</DropdownMenu>

	<OpenMapDialog
		v-if="dialog === 'open-map'"
		@hidden="dialog = undefined"
	></OpenMapDialog>

	<ManageFavouritesDialog
		v-if="dialog === 'manage-favourites'"
		@hidden="dialog = undefined"
	></ManageFavouritesDialog>

	<MapSettingsDialog
		v-if="dialog === 'create-map'"
		@hidden="dialog = undefined"
		:isCreate="true"
	></MapSettingsDialog>
</template>