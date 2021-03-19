<div class="fm-line-info" v-if="line">
	<div class="d-flex align-items-center">
		<h2 class="flex-grow-1">{{line.name}}</h2>
		<b-button
			v-if="line.ascent != null"
			:pressed.sync="showElevationPlot"
			:title="`${showElevationPlot ? 'Hide' : 'Show'} elevation plot`"
			v-b-tooltip
		><Icon icon="chart-line" :alt="`${showElevationPlot ? 'Hide' : 'Show'} elevation plot`"></Icon></b-button>
	</div>

	<dl>
		<dt class="distance">Distance</dt>
		<dd class="distance">{{line.distance | round(2)}} km <span v-if="line.time != null">({{line.time | fmFormatTime}} h {{line.mode | fmRouteMode}})</span></dd>

		<template v-if="line.ascent != null">
			<dt class="elevation">Climb/drop</dt>
			<dd class="elevation"><ElevationStats :route="line"></ElevationStats></dd>
		</template>

		<template v-if="line.ascent == null || !showElevationPlot" v-for="field in client.types[line.typeId].fields">
			<dt>{{field.name}}</dt>
			<dd v-html="$options.filters.fmFieldContent(line.data[field.name], field)"></dd>
		</template>
	</dl>

	<ElevationPlot :route="line" v-if="line.ascent != null && showElevationPlot"></ElevationPlot>

	<div class="buttons" v-if="line.ascent == null || !showElevationPlot">
		<b-button v-if="!client.readonly" size="sm" v-b-modal.fm-line-info-edit :disabled="isSaving || mapContext.interaction">Edit data</b-button>
		<!-- <b-button v-if="!client.readonly" size="sm" @click="move()" :disabled="isSaving || mapContext.interaction">Move</b-button> -->
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