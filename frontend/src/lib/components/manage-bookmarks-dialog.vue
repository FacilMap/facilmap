<script setup lang="ts">
	import storage, { Bookmark } from "../utils/storage";
	import Icon from "./ui/icon.vue";
	import Draggable from "vuedraggable";
	import { computed } from "vue";
	import ModalDialog from "./ui/modal-dialog.vue";
	import { injectContextRequired, requireClientContext } from "./facil-map-context-provider/facil-map-context-provider.vue";

	const context = injectContextRequired();
	const client = requireClientContext(context);

	const emit = defineEmits<{
		hidden: [];
	}>();

	const isBookmarked = computed(() => {
		return !!client.value.padId && storage.bookmarks.some((bookmark) => bookmark.id == client.value.padId);
	});

	function deleteBookmark(bookmark: Bookmark): void {
		const index = storage.bookmarks.indexOf(bookmark);
		if (index != -1)
			storage.bookmarks.splice(index, 1);
	}

	function addBookmark(): void {
		storage.bookmarks.push({ id: client.value.padId!, padId: client.value.padData!.id, name: client.value.padData!.name });
	}
</script>

<template>
	<ModalDialog
		title="Manage Bookmarks"
		size="lg"
		class="fm-manage-bookmarks"
		@hidden="emit('hidden')"
	>
		<p>Bookmarks are a quick way to remember and access collaborative maps. They are saved in your browser, other users will not be able to see them.</p>
		<table class="table table-striped table-hover">
			<thead>
				<tr>
					<th>Map ID</th>
					<th>Name</th>
					<th></th>
				</tr>
			</thead>
			<Draggable
				v-model="storage.bookmarks"
				tag="tbody"
				handle=".fm-drag-handle"
				:itemKey="(bookmark: any) => storage.bookmarks.indexOf(bookmark)"
			>
				<template #item="{ element: bookmark }">
					<tr>
						<td :class="{ 'font-weight-bold': bookmark.id == client.padId }">
							{{bookmark.id}}
						</td>
						<td>
							<input class="form-control" v-model="bookmark.customName" :placeholder="bookmark.name" />
						</td>
						<td class="td-buttons text-right">
							<button type="button" class="btn btn-secondary" @click="deleteBookmark(bookmark)">Delete</button>
							<button type="button" class="btn btn-secondary fm-drag-handle"><Icon icon="resize-vertical" alt="Reorder"></Icon></button>
						</td>
					</tr>
				</template>
			</Draggable>
			<tfoot v-if="client.padData && !isBookmarked">
				<tr>
					<td colspan="3">
						<button type="button" class="btn btn-secondary" @click="addBookmark()">Bookmark current map</button>
					</td>
				</tr>
			</tfoot>
		</table>
	</ModalDialog>
</template>