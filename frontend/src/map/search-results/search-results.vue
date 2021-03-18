<div class="fm-search-results" :class="{ isNarrow }">
	<b-carousel :interval="0" v-model="activeTab">
		<b-carousel-slide>
			<b-alert v-if="(!searchResults || searchResults.length == 0) && (!mapResults || mapResults.length == 0)" show variant="danger">No results have been found.</b-alert>

			<slot name="before"></slot>

			<b-list-group v-if="mapResults && mapResults.length > 0">
				<b-list-group-item  v-for="result in mapResults" :active="activeResults.includes(result)" v-fm-scroll-into-view="activeResults.includes(result)">
					<span>
						<a href="javascript:" @click="handleClick(result, $event)">{{result.name}}</a>
						{{" "}}
						<span class="result-type">({{client.types[result.typeId].name}})</span>
					</span>
					<a v-if="showZoom" href="javascript:" @click="handleZoom(result, $event)" title="Zoom to result" v-b-tooltip><Icon icon="zoom-in" alt="Zoom"></Icon></a>
					<a href="javascript:" @click="handleOpen(result, $event)" title="Show details" v-b-tooltip><Icon icon="arrow-right" alt="Details"></Icon></a>
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
					<a v-if="showZoom" href="javascript:" @click="handleZoom(result, $event)" title="Zoom to result" v-b-tooltip><Icon icon="zoom-in" alt="Zoom"></Icon></a>
					<a href="javascript:" @click="handleOpen(result, $event)" title="Show details" v-b-tooltip><Icon icon="arrow-right" alt="Details"></Icon></a>
				</b-list-group-item>
			</b-list-group>

			<slot name="after"></slot>

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
		</b-carousel-slide>

		<b-carousel-slide>
			<SearchResultInfo v-if="openResult" :result="openResult" show-back-button @back="closeResult()"></SearchResultInfo>
		</b-carousel-slide>
	</b-carousel>
</div>