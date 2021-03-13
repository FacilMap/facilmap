
<div class="fm-search-form"> <!-- ng-class="[className, {'has-search-results': hasSearchResults = searchResults.views.length || searchResults.features.length > 0 || (searchResults.types | fmPropertyCount) > 0, 'has-map-results': hasMapResults = mapResults.length > 0, 'has-nothing': hasNothing = searchResults && !hasSearchResults && !hasMapResults}]"> -->
	<b-form @submit.prevent="search()">
		<b-form-group>
			<b-input-group>
				<b-form-input type="search" v-model="searchString" :autofocus="autofocus"></b-form-input>
				<b-input-group-append>
					<b-button type="submit"><Icon icon="search" alt="Search"></Icon></b-button>
					<b-button v-if="searchResults || mapResults" @click="reset()"><Icon icon="remove" alt="Clear"></Icon></b-button>
					<b-dropdown id="fm-search-form-settings">
						<b-dropdown-item @click.native.capture.stop.prevent="autoZoom = !autoZoom"><Icon :icon="autoZoom ? 'check' : 'unchecked'"></Icon> Auto-zoom to results</b-dropdown-item>
						<b-dropdown-item @click.native.capture.stop.prevent="toggleZoomToAll()"><Icon :icon="zoomToAll ? 'check' : 'unchecked'"></Icon> Zoom to all results</b-dropdown-item>
					</b-dropdown>
				</b-input-group-append>
			</b-input-group>
		</b-form-group>
	</b-form>

	<SearchResults
		v-if="searchResults || mapResults"
		:searchResults="searchResults"
		:mapResults="mapResults"
		:activeResults="activeResults"
		:showZoom="!autoZoom || zoomToAll"
		@click-result="showResult"
		@select-result="selectResult"
		@zoom-result="zoomToResult"
	></SearchResults>
</div>