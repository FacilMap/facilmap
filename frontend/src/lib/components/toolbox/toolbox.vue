<script setup lang="ts">
	import { displayView, getLayers, setBaseLayer, toggleOverlay } from "facilmap-leaflet";
	import { Type, View } from "facilmap-types";
	import About from "../about/about.vue";
	import Sidebar from "../ui/sidebar/sidebar.vue";
	import Icon from "../ui/icon/icon.vue";
	import PadSettings from "../pad-settings/pad-settings.vue";
	import SaveView from "../save-view/save-view.vue";
	import ManageViews from "../manage-views/manage-views.vue";
	import { drawLine, drawMarker } from "../../utils/draw";
	import ManageTypes from "../manage-types/manage-types.vue";
	import EditFilter from "../edit-filter/edit-filter.vue";
	import History from "../history/history.vue";
	import storage from "../../utils/storage";
	import ManageBookmarks from "../manage-bookmarks/manage-bookmarks.vue";
	import OpenMap from "../open-map/open-map.vue";
	import Share from "../share/share.vue";
	import { injectContextRequired } from "../../utils/context";
	import { injectClientRequired } from "../../utils/client";
	import { computed, ref } from "vue";
	import { injectMapComponentsRequired } from "../../utils/map-components";
	import { injectMapContextRequired } from "../../utils/map-context";

	const context = injectContextRequired();
	const client = injectClientRequired();
	const mapComponents = injectMapComponentsRequired();
	const mapContext = injectMapContextRequired();

	const props = withDefaults(defineProps<{
		interactive: boolean;
	}>(), {
		interactive: true
	});

	const dialog = ref<
		| "open-map"
		| "manage-bookmarks"
		| "about"
		| "create-pad"
		| "edit-pad"
		| "save-view"
		| "manage-views"
		| "manage-types"
		| "share"
		| "edit-filter"
		| "history"
	>();

	const sidebarVisible = ref(false);

	const hash = computed(() => {
		const v = mapContext.value;
		return v.hash && v.hash != "#" ? v.hash : `${v.zoom}/${v.center.lat}/${v.center.lng}`;
	});

	const links = computed(() => {
		const v = mapContext.value;
		return {
			osm: `https://www.openstreetmap.org/#map=${v.zoom}/${v.center.lat}/${v.center.lng}`,
			google: `https://www.google.com/maps/@?api=1&map_action=map&center=${v.center.lat},${v.center.lng}&zoom=${v.zoom}`,
			googleSatellite: `https://www.google.com/maps/@?api=1&map_action=map&center=${v.center.lat},${v.center.lng}&zoom=${v.zoom}&basemap=satellite`,
			bing: `https://www.bing.com/maps?cp=${v.center.lat}~${v.center.lng}&lvl=${v.zoom}`,
			facilmap: `${context.baseUrl}#${hash.value}`
		};
	});

	const filterQuery = computed(() => {
		const v = mapContext.value;
		if (v.filter) {
			return {
				q: `?filter=${encodeURIComponent(v.filter)}`,
				a: `&filter=${encodeURIComponent(v.filter)}`
			};
		} else {
			return { q: "", a: "" };
		}
	});

	const baseLayers = computed(() => {
		const { baseLayers } = getLayers(mapComponents.value.map);
		return Object.keys(baseLayers).map((key) => ({
			key,
			name: baseLayers[key].options.fmName!,
			active: mapContext.value.layers.baseLayer === key
		}));
	});

	const overlays = computed(() => {
		const { overlays } = getLayers(mapComponents.value.map);
		return Object.keys(overlays).map((key) => ({
			key,
			name: overlays[key].options.fmName!,
			active: mapContext.value.layers.overlays.includes(key)
		}));
	});

	const isBookmarked = computed(() => {
		return !!client.value.padId && storage.bookmarks.some((bookmark) => bookmark.id == client.value.padId);
	});

	function addBookmark(): void {
		storage.bookmarks.push({ id: client.value.padId!, padId: client.value.padData!.id, name: client.value.padData!.name });
	}

	function addObject(type: Type): void {
		if(type.type == "marker")
			addMarker(type);
		else if(type.type == "line")
			addLine(type);
	}

	function addMarker(type: Type): void {
		drawMarker(type, client.value, mapComponents.value);
	}

	function addLine(type: Type): void {
		drawLine(type, client.value, mapComponents.value);
	}

	function doDisplayView(view: View): void {
		displayView(mapComponents.value.map, view, { overpassLayer: mapComponents.value.overpassLayer });
	}

	function doSetBaseLayer(key: string): void {
		setBaseLayer(mapComponents.value.map, key);
	}

	function doToggleOverlay(key: string): void {
		toggleOverlay(mapComponents.value.map, key);
	}

	function importFile(): void {
		mapContext.value.emit("import-file");
	}
</script>

<template>
	<div class="fm-toolbox">
		<a
			v-if="context.isNarrow"
			v-show="!sidebarVisible"
			href="javascript:"
			class="fm-toolbox-toggle"
			@click="sidebarVisible = true"
		><Icon icon="menu-hamburger"></Icon></a>

		<Sidebar :id="`fm${context.id}-toolbox-sidebar`" v-model:visible="sidebarVisible">
			<b-nav-item-dropdown
				text="Collaborative maps"
				v-if="interactive"
				:disabled="!!mapContext.interaction"
				right
			>
				<b-dropdown-item
					v-for="bookmark in storage.bookmarks"
					:href="`${context.baseUrl}${encodeURIComponent(bookmark.id)}#${hash}`"
					v-b-toggle="`fm${context.id}-toolbox-sidebar`"
					:active="bookmark.id == client.padId"
					@click.exact.prevent="context.activePadId = bookmark.id"
				>{{bookmark.customName || bookmark.name}}</b-dropdown-item>

				<b-dropdown-divider v-if="storage.bookmarks.length > 0"></b-dropdown-divider>

				<b-dropdown-item
					v-if="client.padData && !isBookmarked"
					href="javascript:"
					@click="addBookmark()"
				>Bookmark {{client.padData.name}}</b-dropdown-item>

				<b-dropdown-item
					v-if="storage.bookmarks.length > 0"
					href="javascript:"
					@click="dialog = 'manage-bookmarks'"
					v-b-toggle="`fm${context.id}-toolbox-sidebar`"
				>Manage bookmarks</b-dropdown-item>

				<b-dropdown-divider v-if="(client.padData && !isBookmarked) || storage.bookmarks.length > 0"></b-dropdown-divider>

				<b-dropdown-item
					v-if="!client.padId"
					href="javascript:"
					@click="dialog = 'create-pad'"
					v-b-toggle="`fm${context.id}-toolbox-sidebar`"
				>Create a new map</b-dropdown-item>

				<b-dropdown-item
					href="javascript:"
					@click="dialog = 'open-map'"
					v-b-toggle="`fm${context.id}-toolbox-sidebar`"
				>Open {{client.padId ? "another" : "an existing"}} map</b-dropdown-item>

				<b-dropdown-item
					v-if="client.padData"
					:href="links.facilmap"
					@click.exact.prevent="context.activePadId = undefined"
				>Close {{client.padData.name}}</b-dropdown-item>
			</b-nav-item-dropdown>

			<b-nav-item-dropdown
				v-if="!client.readonly && client.padData"
				text="Add"
				:disabled="!!mapContext.interaction"
				right
			>
				<b-dropdown-item
					v-for="type in client.types"
					:disabled="!!mapContext.interaction"
					href="javascript:"
					@click="addObject(type)"
					v-b-toggle="`fm${context.id}-toolbox-sidebar`"
				>{{type.name}}</b-dropdown-item>

				<b-dropdown-divider v-if="client.writable == 2"></b-dropdown-divider>

				<b-dropdown-item
					v-if="client.writable == 2"
					:disabled="!!mapContext.interaction"
					href="javascript:"
					@click="dialog = 'manage-types'"
					v-b-toggle="`fm${context.id}-toolbox-sidebar`"
				>Manage types</b-dropdown-item>
			</b-nav-item-dropdown>

			<b-nav-item-dropdown
				v-if="client.padData && (!client.readonly || Object.keys(client.views).length > 0)"
				text="Views"
				right
			>
				<b-dropdown-item
					v-for="view in client.views"
					href="javascript:"
					@click="doDisplayView(view)"
					v-b-toggle="`fm${context.id}-toolbox-sidebar`"
				>{{view.name}}</b-dropdown-item>

				<b-dropdown-divider v-if="client.writable == 2 && Object.keys(client.views).length > 0"></b-dropdown-divider>

				<b-dropdown-item
					v-if="client.writable == 2"
					href="javascript:"
					@click="dialog = 'save-view'"
					v-b-toggle="`fm${context.id}-toolbox-sidebar`"
				>Save current view</b-dropdown-item>

				<b-dropdown-item
					v-if="client.writable == 2 && Object.keys(client.views).length > 0"
					href="javascript:"
					@click="dialog = 'manage-views'"
					v-b-toggle="`fm${context.id}-toolbox-sidebar`"
				>Manage views</b-dropdown-item>
			</b-nav-item-dropdown>

			<b-nav-item-dropdown text="Map style" right>
				<b-dropdown-item
					v-for="layerInfo in baseLayers"
					:active="layerInfo.active"
					href="javascript:"
					@click.native.capture.stop="doSetBaseLayer(layerInfo.key)"
				>{{layerInfo.name}}</b-dropdown-item>

				<b-dropdown-divider v-if="baseLayers.length > 0 && overlays.length > 0"></b-dropdown-divider>

				<b-dropdown-item
					v-for="layerInfo in overlays"
					:active="layerInfo.active"
					href="javascript:"
					@click.native.capture.stop="doToggleOverlay(layerInfo.key)"
				>{{layerInfo.name}}</b-dropdown-item>

				<b-dropdown-divider></b-dropdown-divider>

				<b-dropdown-item :href="links.osm" target="_blank">Open this on OpenStreetMap</b-dropdown-item>

				<b-dropdown-item :href="links.google" target="_blank">Open this on Google Maps</b-dropdown-item>

				<b-dropdown-item :href="links.googleSatellite" target="_blank">Open this on Google Maps (Satellite)</b-dropdown-item>

				<b-dropdown-item :href="links.bing" target="_blank">Open this on Bing Maps</b-dropdown-item>
			</b-nav-item-dropdown>

			<b-nav-item-dropdown text="Tools" right v-if="interactive || client.padData">
				<b-dropdown-item
					v-if="interactive"
					href="javascript:"
					@click="dialog = 'share'"
					v-b-toggle="`fm${context.id}-toolbox-sidebar`"
				>Share</b-dropdown-item>

				<b-dropdown-item
					v-if="interactive"
					href="javascript:"
					@click="importFile()"
					v-b-toggle="`fm${context.id}-toolbox-sidebar`"
				>Open file</b-dropdown-item>

				<b-dropdown-item
					v-if="client.padData"
					:href="`${client.padData.id}/geojson${filterQuery.q}`"
					target="_blank"
					v-b-tooltip.hover.left="'GeoJSON files store all map information and can thus be used for map backups and be re-imported without any loss.'"
				>Export as GeoJSON</b-dropdown-item>

				<b-dropdown-item
					v-if="client.padData"
					:href="`${client.padData.id}/gpx?useTracks=1${filterQuery.a}`"
					target="_blank"
					v-b-tooltip.hover.left="'GPX files can be opened with most navigation software. In track mode, any calculated routes are saved in the file.'"
				>Export as GPX (tracks)</b-dropdown-item>

				<b-dropdown-item
					v-if="client.padData"
					:href="`${client.padData.id}/gpx?useTracks=0${filterQuery.a}`"
					target="_blank"
					v-b-tooltip.hover.left="'GPX files can be opened with most navigation software. In route mode, only the start/end/via points are saved in the file, and the navigation software needs to recalculate the routes.'"
				>Export as GPX (routes)</b-dropdown-item>

				<b-dropdown-item
					v-if="client.padData"
					:href="`${client.padData.id}/table${filterQuery.q}`"
					target="_blank"
				>Export as table</b-dropdown-item>

				<b-dropdown-divider v-if="client.padData"></b-dropdown-divider>

				<b-dropdown-item
					v-if="client.padData"
					href="javascript:"
					@click="dialog = 'edit-filter'"
					v-b-toggle="`fm${context.id}-toolbox-sidebar`"
				>Filter</b-dropdown-item>

				<b-dropdown-item
					v-if="client.writable == 2 && client.padData"
					href="javascript:"
					@click="dialog = 'edit-pad'"
					v-b-toggle="`fm${context.id}-toolbox-sidebar`"
				>Settings</b-dropdown-item>

				<b-dropdown-item
					v-if="!client.readonly && client.padData"
					href="javascript:"
					@click="dialog = 'history'"
					v-b-toggle="`fm${context.id}-toolbox-sidebar`"
				>Show edit history</b-dropdown-item>
			</b-nav-item-dropdown>

			<b-nav-item-dropdown text="Help" right>
				<b-dropdown-item href="https://docs.facilmap.org/users/" target="_blank">Documentation</b-dropdown-item>

				<b-dropdown-item href="https://matrix.to/#/#facilmap:rankenste.in" target="_blank">Matrix chat room</b-dropdown-item>

				<b-dropdown-item href="https://github.com/FacilMap/facilmap/issues" target="_blank">Report a problem</b-dropdown-item>

				<b-dropdown-item href="https://github.com/FacilMap/facilmap/discussions" target="_blank">Ask a question</b-dropdown-item>

				<b-dropdown-item
					@click="dialog = 'about'"
					v-b-toggle="`fm${context.id}-toolbox-sidebar`"
					href="javascript:"
				>About FacilMap</b-dropdown-item>
			</b-nav-item-dropdown>
		</Sidebar>

		<OpenMap
			v-if="dialog === 'open-map'"
			@hide="dialog = undefined"
			:id="`fm${context.id}-toolbox-open-map`"
		></OpenMap>

		<ManageBookmarks
			v-if="dialog === 'manage-bookmarks'"
			@hide="dialog = undefined"
			:id="`fm${context.id}-toolbox-manage-bookmarks`"
		></ManageBookmarks>

		<About
			v-if="dialog === 'about'"
			@hide="dialog = undefined"
			:id="`fm${context.id}-toolbox-about`"
		></About>

		<PadSettings
			v-if="dialog === 'create-pad'"
			@hide="dialog = undefined"
			:id="`fm${context.id}-toolbox-create-pad`"
			:isCreate="true"
		></PadSettings>

		<PadSettings
			v-if="dialog === 'edit-pad' && client.padData"
			@hide="dialog = undefined"
			:id="`fm${context.id}-toolbox-edit-pad`"
		></PadSettings>

		<SaveView
			v-if="dialog === 'save-view' && client.padData"
			@hide="dialog = undefined"
			:id="`fm${context.id}-toolbox-save-view`"
		></SaveView>

		<ManageViews
			v-if="dialog === 'manage-views' && client.padData"
			@hide="dialog = undefined"
			:id="`fm${context.id}-toolbox-manage-views`"
		></ManageViews>

		<ManageTypes
			v-if="dialog === 'manage-types' && client.padData"
			@hide="dialog = undefined"
			:id="`fm${context.id}-toolbox-manage-types`"
		></ManageTypes>

		<Share
			v-if="dialog === 'share'"
			@hide="dialog = undefined"
			:id="`fm${context.id}-toolbox-share`"
		></Share>

		<EditFilter
			v-if="dialog === 'edit-filter' && client.padData"
			@hide="dialog = undefined"
			:id="`fm${context.id}-toolbox-edit-filter`"
		></EditFilter>

		<History
			v-if="dialog === 'history' && client.padData"
			@hide="dialog = undefined"
			:id="`fm${context.id}-toolbox-history`"
		></History>
	</div>
</template>

<style lang="scss">
	.fm-toolbox {
		position: absolute;
		top: 10px;
		right: 10px;

		&:hover {
			z-index: 1000;
		}

		.fm-toolbox-toggle {
			color: #444;
			border-radius: 4px;
			background: #fff;
			border: 2px solid rgba(0,0,0,0.2);
			width: 34px;
			height: 34px;
			display: flex;
			align-items: center;
			justify-content: center;

			&:hover {
				background: #f4f4f4;
			}
		}

		.fm-sidebar:not(.isNarrow) {
			opacity: .5;
			transition: opacity .7s;

			&:hover {
				opacity: 1;
			}
		}

		@media print {
			display: none;
		}
	}
</style>