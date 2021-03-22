import Vue from "vue";

export interface Storage {
	zoomToAll: boolean;
	autoZoom: boolean;
}

const storage = Vue.observable({
	zoomToAll: false,
	autoZoom: true
});

export default storage;

try {
	const val = localStorage.getItem("facilmap");
	if (val) {
		const parsed = JSON.parse(val);
		storage.zoomToAll = !!parsed.zoomToAll;
		storage.autoZoom = !!parsed.autoZoom;
	}
} catch (err) {
	console.error("Error reading local storage", err);
}

const watcher = new Vue({ data: { storage } });
watcher.$watch("storage", () => {
	try {
		localStorage.setItem("facilmap", JSON.stringify(storage));
	} catch (err) {
		console.error("Error saving to local storage", err);
	}
}, { deep: true });