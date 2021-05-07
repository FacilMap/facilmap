<div class="fm-route-form">
	<b-form @submit.prevent="handleSubmit">
		<draggable v-model="destinations" handle=".fm-drag-handle" @end="reroute(true)">
			<b-form-group v-for="(destination, idx) in destinations" :class="{ active: hoverDestinationIdx == idx }">
				<hr class="fm-route-form-hover-insert" :class="{ active: hoverInsertIdx === idx }"/>
				<b-input-group @mouseenter="destinationMouseOver(idx)" @mouseleave="destinationMouseOut(idx)" :state="getValidationState(destination)">
					<b-input-group-prepend>
						<b-input-group-text class="px-2"><a href="javascript:" class="fm-drag-handle" @contextmenu.prevent><Icon icon="resize-vertical" alt="Reorder"></Icon></a></b-input-group-text>
					</b-input-group-prepend>
					<b-form-input v-model="destination.query" :placeholder="idx == 0 ? 'From' : idx == destinations.length-1 ? 'To' : 'Via'" :tabindex="idx+1" :state="getValidationState(destination)"></b-form-input>
					<b-input-group-append>
						<b-dropdown v-if="destination.query.trim() != ''" @show="loadSuggestions(destination)" :menu-class="['fm-route-suggestions', { isPending: !destination.searchSuggestions, isNarrow: context.isNarrow }]">
							<template v-if="destination.searchSuggestions">
								<template v-for="suggestion in destination.mapSuggestions">
									<b-dropdown-item
										:active="suggestion === getSelectedSuggestion(destination)"
										@mouseenter.native="suggestionMouseOver(suggestion)"
										@mouseleave.native="suggestionMouseOut(suggestion)"
										@click.native.capture.stop.prevent="suggestionZoom(suggestion)"
										class="fm-route-form-suggestions-zoom"
									><Icon icon="zoom-in" alt="Zoom"></Icon></b-dropdown-item>
									<b-dropdown-item
									:active="suggestion === getSelectedSuggestion(destination)"
										@mouseenter.native="suggestionMouseOver(suggestion)"
										@mouseleave.native="suggestionMouseOut(suggestion)"
										@click="destination.selectedSuggestion = suggestion; reroute(true)"
									>{{suggestion.name}} ({{client.types[suggestion.typeId].name}})</b-dropdown-item>
								</template>
								<b-dropdown-divider
									v-if="(destination.searchSuggestions || []).length > 0 && (destination.mapSuggestions || []).length > 0"
									class="fm-route-form-suggestions-divider"
								></b-dropdown-divider>
								<template v-for="suggestion in destination.searchSuggestions">
									<b-dropdown-item
										href="javascript:"
										:active="suggestion === getSelectedSuggestion(destination)"
										@mouseenter.native="suggestionMouseOver(suggestion)"
										@mouseleave.native="suggestionMouseOut(suggestion)"
										@click.native.capture.stop.prevent="suggestionZoom(suggestion)"
										class="fm-route-form-suggestions-zoom"
									><Icon icon="zoom-in" alt="Zoom"></Icon></b-dropdown-item>
									<b-dropdown-item
										href="javascript:"
										:active="suggestion === getSelectedSuggestion(destination)"
										@mouseenter.native="suggestionMouseOver(suggestion)"
										@mouseleave.native="suggestionMouseOut(suggestion)"
										@click="destination.selectedSuggestion = suggestion; reroute(true)"
									>{{suggestion.display_name}}<span v-if="suggestion.type"> ({{suggestion.type}})</span></b-dropdown-item>
								</template>
							</template>
							<b-spinner v-else></b-spinner>
						</b-dropdown>
						<b-button v-if="destinations.length > 2" @click="removeDestination(idx); reroute(false)" v-b-tooltip.hover.right="'Remove this destination'"><Icon icon="minus" alt="Remove" size="1.0em"></Icon></b-button>
					</b-input-group-append>
				</b-input-group>
			</b-form-group>
			<hr class="fm-route-form-hover-insert" :class="{ active: hoverInsertIdx === destinations.length }"/>
		</draggable>

		<b-button-toolbar>
			<b-button @click="addDestination()" v-b-tooltip.hover.bottom="'Add another destination'" :tabindex="destinations.length+1"><Icon icon="plus" alt="Add"></Icon></b-button>

			<RouteMode v-model="routeMode" :tabindex="destinations.length+2" @input="reroute(false)" tooltip-placement="bottom"></RouteMode>

			<b-button type="submit" variant="primary" :tabindex="destinations.length+7" class="flex-grow-1" ref="submitButton">Go!</b-button>
			<b-button v-if="hasRoute" type="button" :tabindex="destinations.length+8" @click="reset()" v-b-tooltip.hover.right="'Clear route'"><Icon icon="remove" alt="Clear"></Icon></b-button>
		</b-button-toolbar>

		<template v-if="routeError">
			<hr />

			<b-alert variant="danger" show>{{routeError}}</b-alert>
		</template>

		<template v-if="routeObj">
			<hr />

			<dl>
				<dt>Distance</dt>
				<dd>{{routeObj.distance | round(2)}} km <span v-if="routeObj.time != null">({{routeObj.time | fmFormatTime}} h {{routeObj.mode | fmRouteMode}})</span></dd>

				<template v-if="routeObj.ascent != null">
					<dt>Climb/drop</dt>
					<dd><ElevationStats :route="routeObj"></ElevationStats></dd>
				</template>
			</dl>

			<ElevationPlot :route="routeObj" v-if="routeObj.ascent != null"></ElevationPlot>

			<b-button-toolbar v-if="showToolbar && !client.readonly">
				<b-button v-b-tooltip.hover="'Zoom to route'" @click="zoomToRoute()" size="sm"><Icon icon="zoom-in" alt="Zoom to route"></Icon></b-button>

				<b-dropdown v-if="lineTypes.length > 0" size="sm" :disabled="isAdding">
					<template #button-content>
						<b-spinner small v-if="isAdding"></b-spinner>
						Add to map
					</template>

					<b-dropdown-item v-for="type in lineTypes" href="javascript:" @click="addToMap(type)">{{type.name}}</b-dropdown-item>
				</b-dropdown>
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
			</b-button-toolbar>
		</template>
	</b-form>
</div>