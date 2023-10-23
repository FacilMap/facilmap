<script setup lang="ts">
	// import PadSettings from "../pad-settings/pad-settings.vue";
	import storage from "../../utils/storage";
	// import ManageBookmarks from "../manage-bookmarks/manage-bookmarks.vue";
	// import OpenMap from "../open-map/open-map.vue";
	import { injectContextRequired } from "../../utils/context";
	import { injectClientRequired } from "../client-context.vue";
	import { computed, ref } from "vue";
	import { injectMapContextRequired } from "../leaflet-map/leaflet-map.vue";

	const context = injectContextRequired();
	const client = injectClientRequired();
	const mapContext = injectMapContextRequired();

	const emit = defineEmits<{
		(type: "hide-sidebar"): void;
	}>();

	const dialog = ref<
		| "open-map"
		| "manage-bookmarks"
		| "create-pad"
	>();

	const hash = computed(() => {
		const v = mapContext;
		return v.hash && v.hash != "#" ? v.hash : `${v.zoom}/${v.center.lat}/${v.center.lng}`;
	});

	const isBookmarked = computed(() => {
		return !!client.padId && storage.bookmarks.some((bookmark) => bookmark.id == client.padId);
	});

	function addBookmark(): void {
		storage.bookmarks.push({ id: client.padId!, padId: client.padData!.id, name: client.padData!.name });
	}
</script>

<template>
	<li class="nav-item dropdown">
		<a
			class="nav-link dropdown-toggle"
			href="javascript:"
			data-bs-toggle="dropdown"
			:class="{ disabled: !!mapContext.interaction }"
			:tabindex="mapContext.interaction ? -1 : undefined"
		>Collaborative maps</a>
		<ul class="dropdown-menu dropdown-menu-end">
			<li v-for="bookmark in storage.bookmarks">
				<a
					class="dropdown-item"
					:class="{ active: bookmark.id == client.padId }"
					:href="`${context.baseUrl}${encodeURIComponent(bookmark.id)}#${hash}`"
					@click.exact.prevent="context.activePadId = bookmark.id; emit('hide-sidebar')"
				>{{bookmark.customName || bookmark.name}}</a>
			</li>

			<li v-if="storage.bookmarks.length > 0">
				<hr class="dropdown-divider">
			</li>

			<li v-if="client.padData && !isBookmarked">
				<a
					class="dropdown-item"
					href="javascript:"
					@click="addBookmark()"
				>Bookmark {{client.padData.name}}</a>
			</li>

			<li v-if="storage.bookmarks.length > 0">
				<a
					class="dropdown-item"
					href="javascript:"
					@click="dialog = 'manage-bookmarks'; emit('hide-sidebar')"
				>Manage bookmarks</a>
			</li>

			<li v-if="(client.padData && !isBookmarked) || storage.bookmarks.length > 0">
				<hr class="dropdown-divider">
			</li>

			<li v-if="!client.padId">
				<a
					class="dropdown-item"
					href="javascript:"
					@click="dialog = 'create-pad'; emit('hide-sidebar')"
				>Create a new map</a>
			</li>

			<li>
				<a
					class="dropdown-item"
					href="javascript:"
					@click="dialog = 'open-map'; emit('hide-sidebar')"
				>Open {{client.padId ? "another" : "an existing"}} map</a>
			</li>

			<li v-if="client.padData">
				<a
					class="dropdown-item"
					:href="`${context.baseUrl}#${hash}`"
					@click.exact.prevent="context.activePadId = undefined"
				>Close {{client.padData.name}}</a>
			</li>
		</ul>
	</li>

	<!-- <OpenMap
		v-if="dialog === 'open-map'"
		@hidden="dialog = undefined"
	></OpenMap>

	<ManageBookmarks
		v-if="dialog === 'manage-bookmarks'"
		@hidden="dialog = undefined"
	></ManageBookmarks>

	<PadSettings
		v-if="dialog === 'create-pad'"
		@hidden="dialog = undefined"
		:isCreate="true"
	></PadSettings> -->
</template>