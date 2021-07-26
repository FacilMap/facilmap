<div class="fm-toolbox">
	<a v-if="context.isNarrow" href="javascript:" class="fm-toolbox-toggle" v-b-toggle="`fm${context.id}-toolbox-sidebar`"><Icon icon="menu-hamburger"></Icon></a>

	<Sidebar :id="`fm${context.id}-toolbox-sidebar`">
		<b-nav-item-dropdown
			text="Collaborative maps"
			v-if="interactive"
			:disabled="!!mapContext.interaction"
			right
		>
			<b-dropdown-item
				v-for="bookmark in bookmarks"
				:href="`${context.baseUrl}${encodeURIComponent(bookmark.id)}#${hash}`"
				v-b-toggle="`fm${context.id}-toolbox-sidebar`"
				:active="bookmark.id == client.padId"
				@click.exact.prevent="context.activePadId = bookmark.id"
			>{{bookmark.customName || bookmark.name}}</b-dropdown-item>
			<b-dropdown-divider v-if="bookmarks.length > 0"></b-dropdown-divider>
			<b-dropdown-item
				v-if="client.padData && !this.isBookmarked"
				href="javascript:"
				@click="addBookmark()"
			>Bookmark {{client.padData.name}}</b-dropdown-item>
			<b-dropdown-item
				v-if="bookmarks.length > 0"
				href="javascript:"
				v-b-modal="`fm${context.id}-toolbox-manage-bookmarks`"
				v-b-toggle="`fm${context.id}-toolbox-sidebar`"
			>Manage bookmarks</b-dropdown-item>
			<b-dropdown-divider v-if="(client.padData && !this.isBookmarked) || bookmarks.length > 0"></b-dropdown-divider>
			<b-dropdown-item
				v-if="!client.padId"
				href="javascript:"
				v-b-modal="`fm${context.id}-toolbox-create-pad`"
				v-b-toggle="`fm${context.id}-toolbox-sidebar`"
			>Create a new map</b-dropdown-item>
			<b-dropdown-item
				href="javascript:"
				v-b-modal="`fm${context.id}-toolbox-open-map`"
				v-b-toggle="`fm${context.id}-toolbox-sidebar`"
			>Open {{client.padId ? "another" : "an existing"}} map</b-dropdown-item>
			<b-dropdown-item
				v-if="client.padData"
				:href="links.facilmap"
				@click.exact.prevent="context.activePadId = undefined"
			>Close {{client.padData.name}}</b-dropdown-item>
		</b-nav-item-dropdown>

		<b-nav-item-dropdown v-if="!client.readonly && client.padData" text="Add" :disabled="!!mapContext.interaction" right>
			<b-dropdown-item v-for="type in client.types" :disabled="!!mapContext.interaction" href="javascript:" @click="addObject(type)" v-b-toggle="`fm${context.id}-toolbox-sidebar`">{{type.name}}</b-dropdown-item>
			<b-dropdown-divider v-if="client.writable == 2"></b-dropdown-divider>
			<b-dropdown-item v-if="client.writable == 2" :disabled="!!mapContext.interaction" href="javascript:" v-b-modal="`fm${context.id}-toolbox-manage-types`" v-b-toggle="`fm${context.id}-toolbox-sidebar`">Manage types</b-dropdown-item>
		</b-nav-item-dropdown>
		<b-nav-item-dropdown v-if="client.padData && (!client.readonly || Object.keys(client.views).length > 0)" text="Views" right>
			<b-dropdown-item v-for="view in client.views" href="javascript:" @click="displayView(view)" v-b-toggle="`fm${context.id}-toolbox-sidebar`">{{view.name}}</b-dropdown-item>
			<b-dropdown-divider v-if="client.writable == 2 && Object.keys(client.views).length > 0"></b-dropdown-divider>
			<b-dropdown-item v-if="client.writable == 2" href="javascript:" v-b-modal="`fm${context.id}-toolbox-save-view`" v-b-toggle="`fm${context.id}-toolbox-sidebar`">Save current view</b-dropdown-item>
			<b-dropdown-item v-if="client.writable == 2 && Object.keys(client.views).length > 0" href="javascript:" v-b-modal="`fm${context.id}-toolbox-manage-views`" v-b-toggle="`fm${context.id}-toolbox-sidebar`">Manage views</b-dropdown-item>
		</b-nav-item-dropdown>
		<b-nav-item-dropdown text="Map style" right>
			<b-dropdown-item v-for="layerInfo in baseLayers" :active="layerInfo.active" href="javascript:" @click.native.capture.stop="setBaseLayer(layerInfo.key)">{{layerInfo.name}}</b-dropdown-item>
			<b-dropdown-divider v-if="baseLayers.length > 0 && overlays.length > 0"></b-dropdown-divider>
			<b-dropdown-item v-for="layerInfo in overlays" :active="layerInfo.active" href="javascript:" @click.native.capture.stop="toggleOverlay(layerInfo.key)">{{layerInfo.name}}</b-dropdown-item>
			<b-dropdown-divider></b-dropdown-divider>
			<b-dropdown-item :href="links.osm" target="_blank">Open this on OpenStreetMap</b-dropdown-item>
			<b-dropdown-item :href="links.google" target="_blank">Open this on Google Maps</b-dropdown-item>
			<b-dropdown-item :href="links.googleSatellite" target="_blank">Open this on Google Maps (Satellite)</b-dropdown-item>
			<b-dropdown-item :href="links.bing" target="_blank">Open this on Bing Maps</b-dropdown-item>
		</b-nav-item-dropdown>
		<b-nav-item-dropdown text="Tools" right v-if="interactive || client.padData">
			<b-dropdown-item v-if="interactive" href="javascript:" v-b-modal="`fm${context.id}-toolbox-share`" v-b-toggle="`fm${context.id}-toolbox-sidebar`">Share</b-dropdown-item>
			<b-dropdown-item v-if="interactive" href="javascript:" @click="importFile()" v-b-toggle="`fm${context.id}-toolbox-sidebar`">Open file</b-dropdown-item>
			<b-dropdown-item v-if="client.padData" :href="`${client.padData.id}/geojson${filterQuery.q}`" target="_blank" v-b-tooltip.hover.left="'GeoJSON files store all map information and can thus be used for map backups and be re-imported without any loss.'">Export as GeoJSON</b-dropdown-item>
			<b-dropdown-item v-if="client.padData" :href="`${client.padData.id}/gpx?useTracks=1${filterQuery.a}`" target="_blank" v-b-tooltip.hover.left="'GPX files can be opened with most navigation software. In track mode, any calculated routes are saved in the file.'">Export as GPX (tracks)</b-dropdown-item>
			<b-dropdown-item v-if="client.padData" :href="`${client.padData.id}/gpx?useTracks=0${filterQuery.a}`" target="_blank" v-b-tooltip.hover.left="'GPX files can be opened with most navigation software. In route mode, only the start/end/via points are saved in the file, and the navigation software needs to recalculate the routes.'">Export as GPX (routes)</b-dropdown-item>
			<b-dropdown-item v-if="client.padData" :href="`${client.padData.id}/table${filterQuery.q}`" target="_blank">Export as table</b-dropdown-item>
			<b-dropdown-divider v-if="client.padData"></b-dropdown-divider>
			<b-dropdown-item v-if="client.padData" href="javascript:" v-b-modal="`fm${context.id}-toolbox-edit-filter`" v-b-toggle="`fm${context.id}-toolbox-sidebar`">Filter</b-dropdown-item>
			<b-dropdown-item v-if="client.writable == 2 && client.padData" href="javascript:" v-b-modal="`fm${context.id}-toolbox-edit-pad`" v-b-toggle="`fm${context.id}-toolbox-sidebar`">Settings</b-dropdown-item>
			<b-dropdown-item v-if="!client.readonly && client.padData" href="javascript:" v-b-modal="`fm${context.id}-toolbox-history`" v-b-toggle="`fm${context.id}-toolbox-sidebar`">Show edit history</b-dropdown-item>
		</b-nav-item-dropdown>
		<b-nav-item-dropdown text="Help" right>
			<b-dropdown-item href="https://docs.facilmap.org/users/" target="_blank">Documentation</b-dropdown-item>
			<b-dropdown-item href="https://github.com/FacilMap/facilmap/issues" target="_blank">Report a problem</b-dropdown-item>
			<b-dropdown-item href="https://github.com/FacilMap/facilmap/discussions" target="_blank">Ask a question</b-dropdown-item>
			<b-dropdown-item v-b-modal="`fm${context.id}-toolbox-about`" v-b-toggle="`fm${context.id}-toolbox-sidebar`" href="javascript:">About FacilMap</b-dropdown-item>
		</b-nav-item-dropdown>
	</Sidebar>

	<OpenMap :id="`fm${context.id}-toolbox-open-map`"></OpenMap>
	<ManageBookmarks :id="`fm${context.id}-toolbox-manage-bookmarks`"></ManageBookmarks>
	<About :id="`fm${context.id}-toolbox-about`"></About>
	<PadSettings v-if="!client.padData" :id="`fm${context.id}-toolbox-create-pad`" :isCreate="true"></PadSettings>
	<PadSettings v-if="client.padData" :id="`fm${context.id}-toolbox-edit-pad`"></PadSettings>
	<SaveView v-if="client.padData" :id="`fm${context.id}-toolbox-save-view`"></SaveView>
	<ManageViews v-if="client.padData" :id="`fm${context.id}-toolbox-manage-views`"></ManageViews>
	<ManageTypes v-if="client.padData" :id="`fm${context.id}-toolbox-manage-types`"></ManageTypes>
	<Share :id="`fm${context.id}-toolbox-share`"></Share>
	<EditFilter v-if="client.padData" :id="`fm${context.id}-toolbox-edit-filter`"></EditFilter>
	<History v-if="client.padData" :id="`fm${context.id}-toolbox-history`"></History>
</div>