
<div class="fm-search-form">
	<b-form @submit.prevent="handleSubmit()">
		<b-form-group>
			<b-input-group>
				<b-form-input type="search" v-model="searchString" :autofocus="autofocus" ref="searchInput"></b-form-input>
				<b-input-group-append>
					<b-button type="submit"><Icon icon="search" alt="Search"></Icon></b-button>
					<b-button v-if="searchResults || mapResults || fileResult" @click="reset()"><Icon icon="remove" alt="Clear"></Icon></b-button>
					<b-dropdown id="fm-search-form-settings">
						<b-dropdown-item @click.native.capture.stop.prevent="autoZoom = !autoZoom"><Icon :icon="autoZoom ? 'check' : 'unchecked'"></Icon> Auto-zoom to results</b-dropdown-item>
						<b-dropdown-item @click.native.capture.stop.prevent="zoomToAll = !zoomToAll"><Icon :icon="zoomToAll ? 'check' : 'unchecked'"></Icon> Zoom to all results</b-dropdown-item>
					</b-dropdown>
				</b-input-group-append>
			</b-input-group>
		</b-form-group>
	</b-form>

	<FileResults
		v-if="fileResult"
		:file="fileResult"
		:auto-zoom="autoZoom"
		:union-zoom="zoomToAll"
		:layer-id="layerId"
	/>
	<SearchResults
		v-else-if="searchResults || mapResults"
		:search-results="searchResults"
		:map-results="mapResults"
		:auto-zoom="autoZoom"
		:union-zoom="zoomToAll"
		:layer-id="layerId"
	></SearchResults>
</div>