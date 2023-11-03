<script setup lang="ts">
	import storage, { Bookmark } from "../utils/storage";
	import Icon from "./ui/icon.vue";
	import Draggable from "vuedraggable";
	import { injectClientRequired } from "./client-context.vue";
	import { computed } from "vue";
	import ModalDialog from "./ui/modal-dialog.vue";

	const client = injectClientRequired();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const isBookmarked = computed(() => {
		return !!client.padId && storage.bookmarks.some((bookmark) => bookmark.id == client.padId);
	});

	function deleteBookmark(bookmark: Bookmark): void {
		const index = storage.bookmarks.indexOf(bookmark);
		if (index != -1)
			storage.bookmarks.splice(index, 1);
	}

	function addBookmark(): void {
		storage.bookmarks.push({ id: client.padId!, padId: client.padData!.id, name: client.padData!.name });
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