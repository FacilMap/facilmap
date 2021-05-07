<div class="fm-line-info" v-if="line">
	<div class="d-flex align-items-center">
		<h2 class="flex-grow-1">
			<a v-if="showBackButton" href="javascript:" @click="$emit('back')"><Icon icon="arrow-left"></Icon></a>
			{{line.name}}
		</h2>
		<b-button-toolbar v-if="!isMoving">
			<b-button
				v-if="line.ascent != null"
				:pressed.sync="showElevationPlot"
				v-b-tooltip.hover.right="`${showElevationPlot ? 'Hide' : 'Show'} elevation plot`"
			><Icon icon="chart-line" :alt="`${showElevationPlot ? 'Hide' : 'Show'} elevation plot`"></Icon></b-button>

		</b-button-toolbar>
	</div>

	<div class="fm-search-box-collapse-point" v-if="!isMoving">
		<dl>
			<dt class="distance">Distance</dt>
			<dd class="distance">{{line.distance | round(2)}} km <span v-if="line.time != null">({{line.time | fmFormatTime}} h {{line.mode | fmRouteMode}})</span></dd>

			<template v-if="line.ascent != null">
				<dt class="elevation">Climb/drop</dt>
				<dd class="elevation"><ElevationStats :route="line"></ElevationStats></dd>
			</template>

			<template v-if="line.ascent == null || !showElevationPlot" v-for="field in client.types[line.typeId].fields">
				<dt>{{field.name}}</dt>
				<dd v-html="$options.filters.fmFieldContent(line.data.get(field.name), field)"></dd>
			</template>
		</dl>

		<ElevationPlot :route="line" v-if="line.ascent != null && showElevationPlot"></ElevationPlot>
	</div>

	<b-button-toolbar v-if="!isMoving">
		<b-button v-b-tooltip.hover="'Zoom to line'" @click="zoomToLine()" size="sm"><Icon icon="zoom-in" alt="Zoom to line"></Icon></b-button>

		<b-dropdown size="sm" :disabled="isExporting">
			<template #button-content>
				<b-spinner small v-if="isExporting"></b-spinner>
				Export
			</template>

			<b-dropdown-item
				href="javascript:"
				@click="exportRoute('gpx-trk')"
				v-b-tooltip.hover.right="'GPX files can be opened with most navigation software. In track mode, the calculated route is saved in the file.'"
			>Export as GPX track</b-dropdown-item>
			<b-dropdown-item
				href="javascript:"
				@click="exportRoute('gpx-rte')"
				v-b-tooltip.hover.right="'GPX files can be opened with most navigation software. In route mode, only the start/end/via points are saved in the file, and the navigation software needs to calculate the route.'"
			>Export as GPX route</b-dropdown-item>
		</b-dropdown>

		<b-button v-if="!client.readonly" size="sm" v-b-modal="`fm${context.id}-line-info-edit`" :disabled="isDeleting || mapContext.interaction">Edit data</b-button>

		<b-button v-if="!client.readonly && line.mode != 'track'" size="sm" @click="moveLine()" :disabled="isDeleting || mapContext.interaction">Edit waypoints</b-button>

		<b-button v-if="!client.readonly" size="sm" @click="deleteLine()" :disabled="isDeleting || mapContext.interaction">
			<b-spinner small v-if="isDeleting"></b-spinner>
			Remove
		</b-button>
	</b-button-toolbar>

	<RouteForm v-if="isMoving" active ref="routeForm" :route-id="`l${line.id}`" :show-toolbar="false"></RouteForm>

	<EditLine :id="`fm${context.id}-line-info-edit`" :line-id="lineId"></EditLine>
</div>