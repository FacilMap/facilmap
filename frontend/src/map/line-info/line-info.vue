<div class="fm-line-info" v-if="line">
	<h2>{{line.name}}</h2>
	<dl>
		<dt class="distance">Distance</dt>
		<dd class="distance">{{line.distance | round(2)}} km <span v-if="line.time != null">({{line.time | fmFormatTime}} h {{line.mode | fmRouteMode}})</span></dd>

		<template v-if="line.ascent != null">
			<dt class="elevation">Climb/drop</dt>
			<dd class="elevation"><ElevationStats :route="line" :stats="elevationStats"></ElevationStats></dd>
		</template>

		<template v-for="field in client.types[line.typeId].fields">
			<dt>{{field.name}}</dt>
			<dd v-html="$options.filters.fmFieldContent(line.data[field.name], field)"></dd>
		</template>
	</dl>

	<div class="buttons">
		<b-button v-if="!client.readonly" size="sm" v-b-modal.fm-line-info-edit :disabled="isSaving || mapContext.interaction">Edit data</b-button>
		<!-- <button ng-if="!client.readonly && canMoveLine" type="button" class="btn btn-default btn-sm" ng-click="move()" ng-disabled="saving || client.interaction">Move</button> -->
		<b-button v-if="!client.readonly" size="sm" @click="deleteLine()" :disabled="isSaving || mapContext.interaction">Remove</b-button>
		<!--
			<div uib-dropdown keyboard-nav="true" class="dropup">
				<button type="button" class="btn btn-default btn-sm" ng-disabled="saving" uib-dropdown-toggle>Export <span class="caret"></span></button>
				<ul class="dropdown-menu" uib-dropdown-menu role="menu">
					<li role="menuitem"><a href="javascript:" ng-click="export(true)" uib-tooltip="GPX files can be opened with most navigation software. In track mode, the calculated route is saved in the file."tooltip-placement="left">Export as GPX track</a></li>
					<li role="menuitem"><a href="javascript:" ng-click="export(false)" uib-tooltip="GPX files can be opened with most navigation software. In route mode, only the start/end/via points are saved in the file, and the navigation software needs to calculate the route."tooltip-placement="left">Export as GPX route</a></li>
				</ul>
			</div>
		-->
	</div>

	<EditLine id="fm-line-info-edit" :lineId="lineId"></EditLine>
</div>