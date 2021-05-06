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

	@InjectClient() client!: Client;
	@InjectMapComponents() mapComponents!: MapComponents;

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
