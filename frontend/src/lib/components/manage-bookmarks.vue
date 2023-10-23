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
		<b-table-simple striped hover>
			<b-thead>
				<b-tr>
					<b-th>Map ID</b-th>
					<b-th>Name</b-th>
					<b-th></b-th>
				</b-tr>
			</b-thead>
			<draggable v-model="bookmarks" tag="tbody" handle=".fm-drag-handle">
				<b-tr v-for="bookmark in bookmarks">
					<b-td :class="{ 'font-weight-bold': bookmark.id == client.padId }">
						{{bookmark.id}}
					</b-td>
					<b-td>
						<b-input v-model="bookmark.customName" :placeholder="bookmark.name"></b-input>
					</b-td>
					<b-td class="td-buttons text-right">
						<b-button @click="deleteBookmark(bookmark)">Delete</b-button>
						<b-button class="fm-drag-handle"><Icon icon="resize-vertical" alt="Reorder"></Icon></b-button>
					</b-td>
				</b-tr>
			</draggable>
			<b-tfoot v-if="client.padData && !isBookmarked">
				<b-tr>
					<b-td colspan="3">
						<b-button @click="addBookmark()">Bookmark current map</b-button>
					</b-td>
				</b-tr>
			</b-tfoot>
		</b-table-simple>
	</b-modal>
</template>