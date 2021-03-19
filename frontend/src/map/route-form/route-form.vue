<div class="fm-route-form">
	<b-form @submit.prevent="handleSubmit">
		<draggable v-model="destinations" handle=".fm-drag-handle" @end="reroute(true)">
			<!-- ng-class="{'has-error': }" -->
			<b-form-group v-for="(destination, idx) in destinations" :class="{ active: hoverDestinationIdx == idx }">
				<hr class="fm-route-form-hover-insert" :class="{ active: hoverInsertIdx === idx }"/>
				<b-input-group @mouseenter="destinationMouseOver(idx)" @mouseleave="destinationMouseOut(idx)" :state="getValidationState(destination)">
					<b-input-group-prepend>
						<b-input-group-text class="px-2"><a href="javascript:" class="fm-drag-handle"><Icon icon="resize-vertical" alt="Reorder"></Icon></a></b-input-group-text>
					</b-input-group-prepend>
					<b-form-input v-model="destination.query" :placeholder="idx == 0 ? 'From' : idx == destinations.length-1 ? 'To' : 'Via'" :tabindex="idx+1" :state="getValidationState(destination)"></b-form-input>
					<b-input-group-append>
						<b-dropdown v-if="destination.query.trim() != ''" @show="loadSuggestions(destination)" :menu-class="['fm-route-suggestions', { isPending: !destination.searchSuggestions }]">
							<template v-if="destination.searchSuggestions">
								<template v-for="suggestion in destination.mapSuggestions">
									<b-dropdown-item
										:active="suggestion === getSelectedSuggestion(destination)"
										@mouseenter="suggestionMouseOver(suggestion)"
										@mouseleave="suggestionMouseOut(suggestion)"
										@click="suggestionZoom(suggestion)"
										class="fm-route-form-suggestions-zoom"
									><Icon icon="zoom-in" alt="Zoom"></Icon></b-dropdown-item>
									<b-dropdown-item
									:active="suggestion === getSelectedSuggestion(destination)"
										@mouseenter="suggestionMouseOver(suggestion)"
										@mouseleave="suggestionMouseOut(suggestion)"
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
										@mouseenter="suggestionMouseOver(suggestion)"
										@mouseleave="suggestionMouseOut(suggestion)"
										@click="suggestionZoom(suggestion)"
										class="fm-route-form-suggestions-zoom"
									><Icon icon="zoom-in" alt="Zoom"></Icon></b-dropdown-item>
									<b-dropdown-item
										href="javascript:"
										:active="suggestion === getSelectedSuggestion(destination)"
										@mouseenter="suggestionMouseOver(suggestion)"
										@mouseleave="suggestionMouseOut(suggestion)"
										@click="destination.selectedSuggestion = suggestion; reroute(true)"
									>{{suggestion.display_name}}<span v-if="suggestion.type"> ({{suggestion.type}})</span></b-dropdown-item>
								</template>
							</template>
							<b-spinner v-else></b-spinner>
						</b-dropdown>
						<b-button v-if="destinations.length > 2" @click="removeDestination(idx); reroute(false)" title="Remove this destination" v-b-tooltip><Icon icon="minus" alt="Remove" size="1.0em"></Icon></b-button>
					</b-input-group-append>
				</b-input-group>
			</b-form-group>
			<hr class="fm-route-form-hover-insert" :class="{ active: hoverInsertIdx === destinations.length }"/>
		</draggable>

		<b-button-toolbar>
			<b-button @click="addDestination()" title="Add another destination" v-b-tooltip :tabindex="destinations.length+1"><Icon icon="plus" alt="Add"></Icon></b-button>

			<RouteMode v-model="routeMode" :tabindex="destinations.length+2" @input="reroute(false)"></RouteMode>

			<b-button type="submit" variant="primary" :tabindex="destinations.length+7" class="flex-grow-1">Go!</b-button>
			<b-button v-if="hasRoute" type="button" :tabindex="destinations.length+8" @click="reset()" title="Clear route" v-b-tooltip><Icon icon="remove" alt="Clear"></Icon></b-button>
		</b-button-toolbar>

		<template v-if="routeError">
			<hr />

			<b-alert variant="danger" show>{{routeError}}</b-alert>
		</template>

		<template v-if="client.route">
			<hr />

			<dl>
				<dt>Distance</dt>
				<dd>{{client.route.distance | round(2)}} km <span v-if="client.route.time != null">({{client.route.time | fmFormatTime}} h {{client.route.mode | fmRouteMode}})</span></dd>
		
				<!-- <dt class="elevation" v-if="client.route.ascent != null">Climb/drop</dt>
				<dd class="elevation" v-if="client.route.ascent != null"><ElevationStats :route="client.route" :stats="elevationStats"></ElevationStats></dd> -->
			</dl>
				<!-- <div class="fm-elevation-plot" ng-show="client.route.ascent != null"></div> -->

			<!-- <div class="buttons" ng-if="!client.readonly">
				<div uib-dropdown keyboard-nav="true" ng-if="!client._editingLineId && (client.types | fmPropertyCount:{type:'line'}) > 1" class="dropup">
					<button id="add-type-button" type="button" class="btn btn-default btn-sm" uib-dropdown-toggle>Add to map <span class="caret"></span></button>
					<ul class="dropdown-menu" uib-dropdown-menu role="menu" aria-labelledby="add-type-button">
						<li role="menuitem" ng-repeat="type in client.types | fmObjectFilter:{type:'line'}"><a href="javascript:" ng-click="addToMap(type)">{{type.name}}</a></li>
					</ul>
				</div>
				<button ng-if="!client._editingLineId && (client.types | fmPropertyCount:{type:'line'}) == 1" type="button" class="btn btn-default" ng-click="addToMap()">Add to map</button>
				<div uib-dropdown keyboard-nav="true" class="dropup">
					<button type="button" class="btn btn-default btn-sm" uib-dropdown-toggle>Export <span class="caret"></span></button>
					<ul class="dropdown-menu" uib-dropdown-menu role="menu">
						<li role="menuitem"><a href="javascript:" ng-click="export(true)" uib-tooltip="GPX files can be opened with most navigation software. In track mode, the calculated route is saved in the file."tooltip-placement="left">Export as GPX track</a></li>
						<li role="menuitem"><a href="javascript:" ng-click="export(false)" uib-tooltip="GPX files can be opened with most navigation software. In route mode, only the start/end/via points are saved in the file, and the navigation software needs to calculate the route."tooltip-placement="left">Export as GPX route</a></li>
					</ul>
				</div>
			</div> -->
		</template>
	</b-form>
</div>