<div class="fm-marker-info" v-if="marker">
	<h2>{{marker.name}}</h2>
	<dl class="fm-search-box-collapse-point">
		<dt class="pos">Coordinates</dt>
		<dd class="pos">{{marker.lat | round(5)}}, {{marker.lon | round(5)}}</dd>

		<template v-if="marker.ele != null">
			<dt class="elevation">Elevation</dt>
			<dd class="elevation">{{marker.ele}} m</dd>
		</template>

		<template v-for="field in client.types[marker.typeId].fields">
			<dt>{{field.name}}</dt>
			<dd v-html="$options.filters.fmFieldContent(marker.data.get(field.name), field)"></dd>
		</template>
	</dl>

	<b-button-toolbar>
		<b-button v-b-tooltip.hover="'Zoom to marker'" @click="zoomToMarker()" size="sm"><Icon icon="zoom-in" alt="Zoom to line"></Icon></b-button>

		<b-dropdown text="Use as" size="sm" v-if="context.search">
			<b-dropdown-item href="javascript:" @click="useAsFrom()">Route start</b-dropdown-item>
			<b-dropdown-item href="javascript:" @click="useAsVia()">Route via</b-dropdown-item>
			<b-dropdown-item href="javascript:" @click="useAsTo()">Route destination</b-dropdown-item>
		</b-dropdown>

		<b-button v-if="!client.readonly" size="sm" v-b-modal.fm-marker-info-edit :disabled="isSaving || mapContext.interaction">Edit data</b-button>
		<b-button v-if="!client.readonly" size="sm" @click="move()" :disabled="isSaving || mapContext.interaction">Move</b-button>
		<b-button v-if="!client.readonly" size="sm" @click="deleteMarker()" :disabled="isSaving || mapContext.interaction">Remove</b-button>
	</b-button-toolbar>

	<EditMarker id="fm-marker-info-edit" :markerId="markerId"></EditMarker>
</div>