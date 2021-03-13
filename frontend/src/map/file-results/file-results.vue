<div class="fm-file-results">
	<b-alert v-if="(!searchResults || searchResults.length == 0) && (!mapResults || mapResults.length == 0)" show variant="danger">No results have been found.</b-alert>

	<div v-if="searchResults && searchResults.length > 0">
		<div ng-if="searchResults.views.length > 0">
			<h3>Views</h3>
			<ul class="list-group">
				<li ng-repeat="view in searchResults.views" class="list-group-item">
					<a href="javascript:" ng-click="showView(view)">{{view.name}}</a>
					<span class="result-type">(View)</span>
					<a href="javascript:" ng-if="client.padId && client.writable == 2 && !viewExists(view)" ng-click="addView(view)" class="pull-right" uib-tooltip="Add this view to the map" tooltip-append-to-body="true"><fm-icon fm-icon="plus" alt="Add"></fm-icon></a>
				</li>
			</ul>
		</div>
		<h3 ng-if="searchResults.views.length > 0 || (searchResults.types | fmPropertyCount) > 0">Markers/Lines</h3>
		<ul class="list-group" ng-if="searchResults.features.length > 0">
			<li ng-repeat="result in searchResults.features" class="list-group-item" ng-class="{active: result.id && infoBox.currentId == result.id}" fm-scroll-to-view="result.id && infoBox.currentId == result.id">
				<a ng-show="showAll" href="javascript:" ng-click="showResult(result)" uib-tooltip="Zoom to result" tooltip-append-to-body="true"><fm-icon fm-icon="zoom-in" alt="Zoom"></fm-icon></a>
				<a href="javascript:" ng-click="showResult(result, showAll ? 2 : false)">{{result.display_name}}</a>
				<span class="result-type" ng-if="result.type">({{result.type}})</span>
			</li>
		</ul>
		<div ng-if="(searchResults.types | fmPropertyCount) > 0">
			<h3>Types</h3>
			<ul class="list-group">
				<li ng-repeat="type in searchResults.types" class="list-group-item">
					{{type.name}}
					<span class="result-type">(Type)</span>
					<a href="javascript:" ng-if="client.padId && client.writable == 2 && !typeExists(type)" ng-click="addType(type)" class="pull-right" uib-tooltip="Add this type to the map" tooltip-append-to-body="true"><fm-icon fm-icon="plus" alt="Add"></fm-icon></a>
				</li>
			</ul>
		</div>
	</div>

	<div class="fm-search-buttons" ng-show="searchResults.features.length > 0">
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
	</div>

	<hr ng-if="hasSearchResults && mapResults.length > 0"/>

	<h3 ng-if="mapResults.length > 0">On this map</h3>

	<div class="fm-map-results" ng-if="mapResults.length > 0">
		<ul class="list-group">
			<li ng-repeat="result in mapResults" class="list-group-item" ng-class="{active: infoBox.currentId == result.hashId}" fm-scroll-to-view="infoBox.currentId == result.hashId">
				<a href="javascript:" ng-click="showMapResult(result)">{{result.name}}</a>
				<span class="result-type">({{client.types[result.typeId].name}})</span>
			</li>
		</ul>
	</div>
</div>