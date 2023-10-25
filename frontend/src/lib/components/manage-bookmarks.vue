<script setup lang="ts">
	import WithRender from "./manage-bookmarks.vue";
	import Vue from "vue";
	import { Component, Prop } from "vue-property-decorator";
	import { Client, InjectClient, InjectMapComponents } from "../../utils/decorators";
	import { MapComponents } from "../leaflet-map/leaflet-map";
	import storage, { Bookmark } from "../../utils/storage";
	import Icon from "../ui/icon/icon";
	import draggable from "vuedraggable";

	@WithRender
	@Component({
		components: { draggable, Icon }
	})
	export default class ManageBookmarks extends Vue {

		const client = injectClientRequired();
		const mapComponents = injectMapComponentsRequired();

		@Prop({ type: String, required: true }) id!: string;

		get bookmarks(): Bookmark[] {
			return storage.bookmarks;
		}

		set bookmarks(bookmarks: Bookmark[]) {
			// Needed for draggable
			storage.bookmarks = bookmarks;
		}

		get isBookmarked(): boolean {
			return !!this.client.padId && storage.bookmarks.some((bookmark) => bookmark.id == this.client.padId);
		}

		deleteBookmark(bookmark: Bookmark): void {
			const index = storage.bookmarks.indexOf(bookmark);
			if (index != -1)
				storage.bookmarks.splice(index, 1);
		}

		addBookmark(): void {
			storage.bookmarks.push({ id: this.client.padId!, padId: this.client.padData!.id, name: this.client.padData!.name });
		}
	}

</script>

<template>
	<b-modal :id="id" title="Manage Bookmarks" ok-only ok-title="Close" size="lg" dialog-class="fm-manage-bookmarks">
		<p>Bookmarks are a quick way to remember and access collaborative maps. They are saved in your browser, other users will not be able to see them.</p>
		<table class="table table-striped table-hover">
			<thead>
				<tr>
					<th>Map ID</th>
					<th>Name</th>
					<th></th>
				</tr>
			</thead>
			<draggable v-model="bookmarks" tag="tbody" handle=".fm-drag-handle">
				<tr v-for="bookmark in bookmarks">
					<td :class="{ 'font-weight-bold': bookmark.id == client.padId }">
						{{bookmark.id}}
					</td>
					<td>
						<input class="form-control" v-model="bookmark.customName" :placeholder="bookmark.name" />
					</td>
					<td class="td-buttons text-right">
						<button type="button" class="btn btn-light" @click="deleteBookmark(bookmark)">Delete</button>
						<button type="button" class="btn btn-light fm-drag-handle"><Icon icon="resize-vertical" alt="Reorder"></Icon></button>
					</td>
				</tr>
			</draggable>
			<tfoot v-if="client.padData && !isBookmarked">
				<tr>
					<td colspan="3">
						<button type="button" class="btn btn-light" @click="addBookmark()">Bookmark current map</button>
					</td>
				</tr>
			</tfoot>
		</table>
	</b-modal>
</template>