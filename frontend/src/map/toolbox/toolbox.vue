<div class="fm-toolbox">
	<a v-if="isNarrow" href="javascript:" class="fm-toolbox-toggle" v-b-toggle.fm-toolbox-sidebar><Icon icon="menu-hamburger"></Icon></a>

	<Sidebar id="fm-toolbox-sidebar">
		<b-nav-item v-if="!client.padId && interactive" href="javascript:" v-b-modal.fm-toolbox-create-pad v-b-toggle.fm-toolbox-sidebar>Start collaborative map</b-nav-item>
		<b-nav-item-dropdown v-if="!client.readonly && client.padData" text="Add" :disabled="!!mapContext.interaction" right>
			<b-dropdown-item v-for="type in client.types" :disabled="!!mapContext.interaction" href="javascript:" @click="addObject(type)">{{type.name}}</b-dropdown-item>
			<b-dropdown-divider v-if="client.writable == 2"></b-dropdown-divider>
			<b-dropdown-item v-if="client.writable == 2" :disabled="!!mapContext.interaction" href="javascript:" v-b-modal.fm-toolbox-manage-types>Manage types</b-dropdown-item>
		</b-nav-item-dropdown>
		<b-nav-item-dropdown v-if="client.padData && (!client.readonly || Object.keys(client.views).length > 0)" text="Views" right>
			<b-dropdown-item v-for="view in client.views" href="javascript:" @click="displayView(view)">{{view.name}}</b-dropdown-item>
			<b-dropdown-divider v-if="client.writable == 2"></b-dropdown-divider>
			<b-dropdown-item v-if="client.writable == 2" href="javascript:" v-b-modal.fm-toolbox-save-view v-b-toggle.fm-toolbox-sidebar>Save current view</b-dropdown-item>
			<b-dropdown-item v-if="client.writable == 2" href="javascript:" v-b-modal.fm-toolbox-manage-views v-b-toggle.fm-toolbox-sidebar>Manage views</b-dropdown-item>
		</b-nav-item-dropdown>
		<b-nav-item-dropdown text="Map style" right>
			<b-dropdown-item v-for="layerInfo in baseLayers" :active="layerInfo.active" href="javascript:" @click="setBaseLayer(layerInfo.key)">{{layerInfo.name}}</b-dropdown-item>
			<b-dropdown-divider v-if="baseLayers.length > 0 && overlays.length > 0"></b-dropdown-divider>
			<b-dropdown-item v-for="layerInfo in overlays" :active="layerInfo.active" href="javascript:" @click="toggleOverlay(layerInfo.key)">{{layerInfo.name}}</b-dropdown-item>
			<b-dropdown-divider></b-dropdown-divider>
			<b-dropdown-item :href="links.osm" target="_blank">Open this on OpenStreetMap</b-dropdown-item>
			<b-dropdown-item :href="links.google" target="_blank">Open this on Google Maps</b-dropdown-item>
			<b-dropdown-item :href="links.bing" target="_blank">Open this on Bing Maps</b-dropdown-item>
		</b-nav-item-dropdown>
		<b-nav-item-dropdown text="Tools" right>
			<!--<b-dropdown-item v-if="!client.readonly" @click="openDialog('copy-pad-dialog')">Copy pad</b-dropdown-item>-->
			<b-dropdown-item v-if="interactive" href="javascript:" @click="importFile()">Open file</b-dropdown-item>
			<b-dropdown-item v-if="client.padData" :href="`${client.padData.id}/geojson${filterQuery.q}`" title="GeoJSON files store all map information and can thus be used for map backups and be re-imported without any loss.">Export as GeoJSON</b-dropdown-item>
			<b-dropdown-item v-if="client.padData" :href="`${client.padData.id}/gpx?useTracks=1${filterQuery.a}`" title="GPX files can be opened with most navigation software. In track mode, any calculated routes are saved in the file.">Export as GPX (tracks)</b-dropdown-item>
			<b-dropdown-item v-if="client.padData" :href="`${client.padData.id}/gpx?useTracks=0${filterQuery.a}`" title="GPX files can be opened with most navigation software. In route mode, only the start/end/via points are saved in the file, and the navigation software needs to recalculate the routes.">Export as GPX (routes)</b-dropdown-item>
			<b-dropdown-item v-if="client.padData" :href="`${client.padData.id}/table${filterQuery.q}`" target="_blank">Export as table</b-dropdown-item>
			<b-dropdown-divider v-if="client.padData"></b-dropdown-divider>
			<b-dropdown-item v-if="client.padData" href="javascript:" v-b-modal.fm-toolbox-edit-filter v-b-toggle.fm-toolbox-sidebar>Filter</b-dropdown-item>
			<b-dropdown-item v-if="client.writable == 2 && client.padData" href="javascript:" v-b-modal.fm-toolbox-edit-pad v-b-toggle.fm-toolbox-sidebar>Settings</b-dropdown-item>
			<b-dropdown-item v-if="!client.readonly && client.padData" href="javascript:" v-b-modal.fm-toolbox-history v-b-toggle.fm-toolbox-sidebar>Show edit history</b-dropdown-item>
			<b-dropdown-divider v-if="client.padData"></b-dropdown-divider>
			<b-dropdown-item v-b-modal.fm-toolbox-about v-b-toggle.fm-toolbox-sidebar href="javascript:">About FacilMap</b-dropdown-item>
			<b-dropdown-item v-if="client.padData" :href="links.facilmap">Exit collaborative map</b-dropdown-item>
		</b-nav-item-dropdown>
	</Sidebar>

	<About id="fm-toolbox-about"></About>
	<PadSettings v-if="!client.padData" id="fm-toolbox-create-pad" :isCreate="true"></PadSettings>
	<PadSettings v-if="client.padData" id="fm-toolbox-edit-pad"></PadSettings>
	<SaveView v-if="client.padData" id="fm-toolbox-save-view"></SaveView>
	<ManageViews v-if="client.padData" id="fm-toolbox-manage-views"></ManageViews>
	<ManageTypes v-if="client.padData" id="fm-toolbox-manage-types"></ManageTypes>
	<EditFilter v-if="client.padData" id="fm-toolbox-edit-filter"></EditFilter>
	<History v-if="client.padData" id="fm-toolbox-history"></History>
</div>