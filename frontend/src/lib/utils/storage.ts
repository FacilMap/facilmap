import { PadId } from "facilmap-types";
import { isEqual } from "lodash-es";
import { reactive, watch } from "vue";

export interface Bookmark {
	/** ID used to open the map */
	id: PadId;
	/** Read-only ID of the map */
	padId: PadId;
	/** Last known name of the map */
	name: string;
	/** If this is defined, it is shown instead of the map name. */
	customName?: string;
}

export interface Storage {
	zoomToAll: boolean;
	autoZoom: boolean;
	bookmarks: Bookmark[];
}

const storage: Storage = reactive({
	zoomToAll: false,
	autoZoom: true,
	bookmarks: []
});

export default storage;

function load(): void {
	try {
		const val = localStorage.getItem("facilmap");
		if (val) {
			const parsed = JSON.parse(val);
			storage.zoomToAll = !!parsed.zoomToAll;
			storage.autoZoom = !!parsed.autoZoom;
			storage.bookmarks = parsed.bookmarks || [];
		}
	} catch (err) {
		console.error("Error reading local storage", err);
	}
}

function save() {
	try {
		const currentItem = JSON.parse(localStorage.getItem("facilmap") || "null");
		if (!currentItem || !isEqual(currentItem, storage)) {
			localStorage.setItem("facilmap", JSON.stringify(storage));

			if (storage.bookmarks.length > 0 && !isEqual(currentItem?.bookmarks, storage.bookmarks) && navigator.storage?.persist)
				navigator.storage.persist();
		}


	} catch (err) {
		console.error("Error saving to local storage", err);
	}
}

load();
window.addEventListener("storage", load);

watch(() => storage, save, { deep: true });