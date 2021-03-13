<div class="fm-search-results" :class="{ isNarrow }">
	<b-alert v-if="(!searchResults || searchResults.length == 0) && (!mapResults || mapResults.length == 0)" show variant="danger">No results have been found.</b-alert>

	<b-list-group v-if="mapResults && mapResults.length > 0">
		<b-list-group-item  v-for="result in mapResults" :active="activeResults.includes(result)" class="d-flex justify-content-between align-items-center">
			<span>
			<!-- ng-class="{active: infoBox.currentId == result.hashId}" fm-scroll-to-view="infoBox.currentId == result.hashId"> -->
				<a href="javascript:" @click="$emit('click-map-result', result, $event)">{{result.name}}</a>
				{{" "}}
				<span class="result-type">({{client.types[result.typeId].name}})</span>
			</span>
			<a v-if="showZoom" href="javascript:" @click="$emit('zoom-map-result', result, $event)" title="Zoom to result" v-b-tooltip><Icon icon="zoom-in" alt="Zoom"></Icon></a>
		</b-list-group-item>
	</b-list-group>

	<hr v-if="mapResults && mapResults.length > 0 && searchResults && searchResults.length > 0"/>

	<b-list-group v-if="searchResults && searchResults.length > 0">
		<b-list-group-item v-for="result in searchResults" :active="activeResults.includes(result)" class="d-flex justify-content-between align-items-center">
			<span>
				<!-- :active="result.id && infoBox.currentId == result.id" fm-scroll-to-view="result.id && infoBox.currentId == result.id" -->
				<a href="javascript:" @click="$emit('click-search-result', result, $event)">{{result.display_name}}</a>
				{{" "}}
				<span class="result-type" v-if="result.type">({{result.type}})</span>
			</span>
			<a v-if="showZoom" href="javascript:" @click="$emit('zoom-search-result', result, $event)" title="Zoom to result" v-b-tooltip><Icon icon="zoom-in" alt="Zoom"></Icon></a>
		</b-list-group-item>
	</b-list-group>

	<!-- <div class="fm-search-buttons" ng-show="searchResults.features.length > 0">
		<button type="button" class="btn btn-default" ng-model="showAll" ng-click="showAll && zoomToAll()" uib-btn-checkbox ng-show="searchResults.features.length > 1">Show all</button>
		<button type="button" class="btn btn-link" ng-click="reset()"><fm-icon fm-icon="remove" alt="Remove"></fm-icon></button>
		<div uib-dropdown keyboard-nav="true" class="pull-right dropup" ng-if="client.padId && !client.readonly">
			<button id="search-add-all-button" type="button" class="btn btn-default" uib-dropdown-toggle>Add all to map <span class="caret"></span></button>
			<ul class="dropdown-menu" uib-dropdown-menu role="menu" aria-labelledby="search-add-all-button">
				<li ng-if="(searchResults.types | fmPropertyCount) > 0" role="menuitem"><a href="javascript:" ng-click="customImport()">Custom type mapping…</a></li>
				<li ng-if="(searchResults.features | filter:{isMarker: true}).length > 0" role="menuitem" ng-repeat="type in client.types | fmObjectFilter:{type:'marker'}"><a href="javascript:" ng-click="addAllToMap(type)">Add all markers as {{type.name}}</a></li>
				<li ng-if="(searchResults.features | filter:{isLine: true}).length > 0" role="menuitem" ng-repeat="type in client.types | fmObjectFilter:{type:'line'}"><a href="javascript:" ng-click="addAllToMap(type)">Add all lines/polygons as {{type.name}}</a></li>
			</ul>
		</div>
	</div> -->
</div>