<div class="fm-search-results" :class="{ isNarrow: context.isNarrow }">
	<b-carousel :interval="0" v-model="activeTab">
		<b-carousel-slide>
			<b-alert v-if="(!searchResults || searchResults.length == 0) && (!mapResults || mapResults.length == 0)" show variant="danger">No results have been found.</b-alert>

			<div class="fm-search-box-collapse-point">
				<slot name="before"></slot>

				<b-list-group v-if="mapResults && mapResults.length > 0">
					<b-list-group-item  v-for="result in mapResults" :active="activeResults.includes(result)" v-fm-scroll-into-view="activeResults.includes(result)">
						<span>
							<a href="javascript:" @click="handleClick(result, $event)">{{result.name}}</a>
							{{" "}}
							<span class="result-type">({{client.types[result.typeId].name}})</span>
						</span>
						<a v-if="showZoom" href="javascript:" @click="zoomToResult(result)" v-b-tooltip.hover.left="'Zoom to result'"><Icon icon="zoom-in" alt="Zoom"></Icon></a>
						<a href="javascript:" @click="handleOpen(result, $event)" v-b-tooltip.hover.left="'Show details'"><Icon icon="arrow-right" alt="Details"></Icon></a>
					</b-list-group-item>
				</b-list-group>

				<hr v-if="mapResults && mapResults.length > 0 && searchResults && searchResults.length > 0"/>

				<b-list-group v-if="searchResults && searchResults.length > 0">
					<b-list-group-item v-for="result in searchResults" :active="activeResults.includes(result)" v-fm-scroll-into-view="activeResults.includes(result)">
						<span>
							<a href="javascript:" @click="handleClick(result, $event)">{{result.display_name}}</a>
							{{" "}}
							<span class="result-type" v-if="result.type">({{result.type}})</span>
						</span>
						<a v-if="showZoom" href="javascript:" @click="zoomToResult(result)" v-b-tooltip.hover.left="'Zoom to result'"><Icon icon="zoom-in" alt="Zoom"></Icon></a>
						<a href="javascript:" @click="handleOpen(result, $event)" v-b-tooltip.hover.right="'Show details'"><Icon icon="arrow-right" alt="Details"></Icon></a>
					</b-list-group-item>
				</b-list-group>

				<slot name="after"></slot>
			</div>

			<b-button-toolbar v-if="client.padData && !client.readonly && searchResults && searchResults.length > 0">
				<b-button @click="toggleSelectAll" :pressed="isAllSelected">Select all</b-button>

				<b-dropdown v-if="client.padData && !client.readonly" :disabled="activeSearchResults.length == 0 || isAdding">
					<template #button-content>
						<b-spinner small v-if="isAdding"></b-spinner>
						Add selected item{{activeSearchResults.length == 1 ? '' : 's'}} to map
					</template>
					<template v-if="activeMarkerSearchResults.length > 0 && markerTypes.length ">
						<b-dropdown-item v-for="type in markerTypes" href="javascript:" @click="addToMap(activeMarkerSearchResults, type)">Marker items as {{type.name}}</b-dropdown-item>
					</template>
					<template v-if="activeLineSearchResults.length > 0 && lineTypes.length ">
						<b-dropdown-item v-for="type in lineTypes" href="javascript:" @click="addToMap(activeLineSearchResults, type)">Line/polygon items as {{type.name}}</b-dropdown-item>
					</template>
					<template v-if="hasCustomTypes">
						<b-dropdown-divider></b-dropdown-divider>
						<b-dropdown-item href="javascript:" v-b-modal="customImportModalId">Custom type mapping…</b-dropdown-item>
					</template>
				</b-dropdown>
			</b-button-toolbar>
		</b-carousel-slide>

		<b-carousel-slide>
			<SearchResultInfo
				v-if="openResult"
				:result="openResult"
				show-back-button
				:is-adding="isAdding"
				@back="closeResult()"
				@add-to-map="addToMap([openResult], $event)"
				@use-as-from="useAsFrom(openResult)"
				@use-as-via="useAsVia(openResult)"
				@use-as-to="useAsTo(openResult)"
			></SearchResultInfo>
		</b-carousel-slide>
	</b-carousel>


	<FormModal
		:id="customImportModalId"
		title="Custom Import"
		dialog-class="fm-search-results-custom-import"
		:is-saving="isCustomImportSaving"
		is-create
		ok-title="Import"
		@submit="customImport"
		@show="initializeCustomImport"
	>
		<b-table-simple striped hover>
			<b-thead>
				<b-tr>
					<b-th>Type</b-th>
					<b-th>Map to…</b-th>
				</b-tr>
			</b-thead>
			<b-tbody>
				<b-tr v-for="(options, importTypeId) in customMappingOptions">
					<b-td><label :for="`map-type-${importTypeId}`">{{customTypes[importTypeId].type == 'marker' ? 'Markers' : 'Lines'}} of type “{{customTypes[importTypeId].name}}” ({{activeFileResultsByType[importTypeId].length}})</label></b-td>
					<b-td><b-form-select :id="`map-type-${importTypeId}`" v-model="customMapping[importTypeId]" :options="options"></b-form-select></b-td>
				</b-tr>
				<b-tr v-if="untypedMarkers.length > 0">
					<b-td><label for="map-untyped-markers">Untyped markers ({{untypedMarkers}})</label></b-td>
					<b-td><b-form-select id="map-untyped-markers" v-model="untypedMarkerMapping" :options="untypedMarkerMappingOptions"></b-form-select></b-td>
				</b-tr>
				<b-tr v-if="untypedLines.length > 0">
					<b-td><label for="map-untyped-lines">Untyped lines/polygons ({{untypedLines}})</label></b-td>
					<b-td><b-form-select id="map-untyped-lines" v-model="untypedLineMapping" :options="untypedLineMappingOptions"></b-form-select></b-td>
				</b-tr>
			</b-tbody>
		</b-table-simple>
	</FormModal>
</div>