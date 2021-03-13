<div class="fm-search-result-info" v-if="result">
	<h2>{{result.short_name}}</h2>
	<dl>
		<dt v-if="result.type">Type</dt>
		<dd v-if="result.type">{{result.type}}</dd>

		<dt v-if="result.address">Address</dt>
		<dd v-if="result.address">{{result.address}}</dd>

		<dt v-if="result.type != 'coordinates' && result.lat != null && result.lon != null">Coordinates</dt>
		<dd v-if="result.type != 'coordinates' && result.lat != null && result.lon != null">{{result.lat | round(5)}}, {{result.lon | round(5)}}</dd>

		<dt v-if="result.elevation != null">Elevation</dt>
		<dd v-if="result.elevation != null">{{result.elevation}} m</dd>

		<template v-for="(value, key) in result.extratags">
			<dt>{{key}}</dt>
			<dd v-html="renderOsmTag(key, value)"></dd>
		</template>
	</dl>
</div>
<!-- <div class="buttons">
	{{filteredTypes = (result.isMarker && result.isLine ? client.types : (client.types | fmObjectFilter:{type:result.isMarker ? 'marker' : 'line'})); ""}}
	<div uib-dropdown keyboard-nav="true" ng-if="!client.readonly && (filteredTypes | fmPropertyCount) > 1" class="dropup">
		<button id="add-type-button" type="button" class="btn btn-default btn-sm" uib-dropdown-toggle>Add to map <span class="caret"></span></button>
		<ul class="dropdown-menu" uib-dropdown-menu role="menu" aria-labelledby="add-type-button">
			<li role="menuitem" ng-repeat="type in filteredTypes"><a href="javascript:" ng-click="addToMap(type)">{{type.name}}</a></li>
		</ul>
	</div>
	<button type="button" ng-if="!client.readonly && (filteredTypes | fmPropertyCount) == 1" ng-repeat="type in filteredTypes" class="btn btn-default btn-sm" ng-click="addToMap(type)">Add to map</button>
	<div ng-if="result.isMarker" uib-dropdown keyboard-nav="true" class="dropup">
		<button type="button" class="btn btn-default btn-sm" uib-dropdown-toggle>Use as <span class="caret"></span></button>
		<ul class="dropdown-menu" uib-dropdown-menu role="menu">
			<li role="menuitem"><a href="javascript:" ng-click="useForRoute(1)">Route start</a></li>
			<li role="menuitem"><a href="javascript:" ng-click="useForRoute(2)">Route via</a></li>
			<li role="menuitem"><a href="javascript:" ng-click="useForRoute(3)">Route destination</a></li>
		</ul>
	</div>
</div> -->