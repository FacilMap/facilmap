<div class="fm-marker-info" v-if="marker">
	<h2>{{marker.name}}</h2>
	<dl class="row">
		<dt class="col-sm-4">Coordinates</dt>
		<dd class="col-sm-8">{{marker.lat | round(5)}}, {{marker.lon | round(5)}}</dd>

		<template v-if="marker.ele != null">
			<dt class="col-sm-4 elevation">Elevation</dt>
			<dd class="col-sm-8 elevation">{{marker.ele}} m</dd>
		</template>

		<template v-for="field in client.types[marker.typeId].fields">
			<dt class="col-sm-4">{{field.name}}</dt>
			<dd class="col-sm-8" v-html="$options.filters.fmFieldContent(marker.data[field.name], field)"></dd>
		</template>
	</dl>

	<div class="buttons">
		<b-button v-if="!client.readonly" size="sm" v-b-modal.fm-marker-info-edit :disabled="isSaving || mapContext.interaction">Edit data</b-button>
		<b-button v-if="!client.readonly" size="sm" @click="move()" :disabled="isSaving || mapContext.interaction">Move</b-button>
		<b-button v-if="!client.readonly" size="sm" @click="deleteMarker()" :disabled="isSaving || mapContext.interaction">Remove</b-button>
		<!--
		<div ng-if="map.searchUi" uib-dropdown keyboard-nav="true" class="dropup">
			<button type="button" class="btn btn-default btn-sm" uib-dropdown-toggle ng-disabled="saving">Use as <span class="caret"></span></button>
			<ul class="dropdown-menu" uib-dropdown-menu role="menu">
				<li role="menuitem"><a href="javascript:" ng-click="useForRoute(1)">Route start</a></li>
				<li role="menuitem"><a href="javascript:" ng-click="useForRoute(2)">Route via</a></li>
				<li role="menuitem"><a href="javascript:" ng-click="useForRoute(3)">Route destination</a></li>
			</ul>
		</div>
		-->
	</div>

	<EditMarker id="fm-marker-info-edit" :markerId="markerId"></EditMarker>
</div>