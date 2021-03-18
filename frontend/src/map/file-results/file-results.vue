<div class="fm-file-results">
	<SearchResults
		:search-results="file.features"
		:layer-id="layerId"
		@click-result="$emit('click-result', $event)"
	>
		<template #before>
			<template v-if="hasViews">
				<h3>Views</h3>
				<b-list-group>
					<b-list-group-item v-for="view in file.views">
						<span>
							<a href="javascript:" @click="showView(view)">{{view.name}}</a>
							{{" "}}
							<span class="result-type">(View)</span>
						</span>
						<a href="javascript:" v-if="client.padId && client.writable == 2 && !viewExists(view)" @click="addView(view)" title="Add this view to the map" v-b-tooltip><Icon icon="plus" alt="Add"></Icon></a>
					</b-list-group-item>
				</b-list-group>
			</template>
			<h3 v-if="hasViews || hasTypes">Markers/Lines</h3>
		</template>

		<template #after>
			<template v-if="hasTypes">
				<h3>Types</h3>
				<b-list-group>
					<b-list-group-item v-for="type in file.types">
						<span>
							{{type.name}}
							{{" "}}
							<span class="result-type">(Type)</span>
						</span>
						<a href="javascript:" v-if="client.padId && client.writable == 2 && !typeExists(type)" @click="addType(type)" title="Add this type to the map" v-b-tooltip><Icon icon="plus" alt="Add"></Icon></a>
					</b-list-group-item>
				</b-list-group>
			</template>
		</template>

	<!-- <div class="fm-search-buttons" ng-show="file.features.length > 0">
		<button type="button" class="btn btn-default" ng-model="showAll" ng-click="showAll && zoomToAll()" uib-btn-checkbox ng-show="file.features.length > 1">Show all</button>

		<button type="button" class="btn btn-link" ng-click="reset()"><fm-icon fm-icon="remove" alt="Remove"></fm-icon></button>

		<div uib-dropdown keyboard-nav="true" class="pull-right dropup" ng-if="client.padId && !client.readonly">
			<button id="search-add-all-button" type="button" class="btn btn-default" uib-dropdown-toggle>Add all to map <span class="caret"></span></button>
			<ul class="dropdown-menu" uib-dropdown-menu role="menu" aria-labelledby="search-add-all-button">
				<li ng-if="(file.types | fmPropertyCount) > 0" role="menuitem"><a href="javascript:" ng-click="customImport()">Custom type mapping…</a></li>
				<li ng-if="(file.features | filter:{isMarker: true}).length > 0" role="menuitem" ng-repeat="type in client.types | fmObjectFilter:{type:'marker'}"><a href="javascript:" ng-click="addAllToMap(type)">Add all markers as {{type.name}}</a></li>
				<li ng-if="(file.features | filter:{isLine: true}).length > 0" role="menuitem" ng-repeat="type in client.types | fmObjectFilter:{type:'line'}"><a href="javascript:" ng-click="addAllToMap(type)">Add all lines/polygons as {{type.name}}</a></li>
			</ul>
		</div>
	</div> -->

	</SearchResults>
</div>