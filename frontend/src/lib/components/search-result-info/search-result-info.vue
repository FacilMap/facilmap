<div class="fm-search-result-info" v-if="result">
	<h2>
		<a v-if="showBackButton" href="javascript:" @click="$emit('back')"><Icon icon="arrow-left"></Icon></a>
		{{result.short_name}}
	</h2>
	<dl class="fm-search-box-collapse-point">
		<dt v-if="result.type">Type</dt>
		<dd v-if="result.type">{{result.type}}</dd>

		<dt v-if="result.address">Address</dt>
		<dd v-if="result.address">{{result.address}}</dd>

		<dt v-if="result.type != 'coordinates' && result.lat != null && result.lon != null">Coordinates</dt>
		<dd v-if="result.type != 'coordinates' && result.lat != null && result.lon != null"><Coordinates :point="result"></Coordinates></dd>

		<dt v-if="result.elevation != null">Elevation</dt>
		<dd v-if="result.elevation != null">{{result.elevation}} m</dd>

		<template v-for="(value, key) in result.extratags">
			<dt>{{key}}</dt>
			<dd v-html="renderOsmTag(key, value)"></dd>
		</template>
	</dl>

	<b-button-toolbar>
		<b-button v-b-tooltip.hover="'Zoom to search result'" @click="zoomToResult()" size="sm"><Icon icon="zoom-in" alt="Zoom to search result"></Icon></b-button>

		<b-dropdown v-if="!client.readonly && types.length > 0" :disabled="isAdding" size="sm">
			<template #button-content>
				<b-spinner small v-if="isAdding"></b-spinner>
				Add to map
			</template>
			<b-dropdown-item v-for="type in types" href="javascript:" @click="$emit('add-to-map', type)">{{type.name}}</b-dropdown-item>
		</b-dropdown>

		<b-dropdown v-if="isMarker && context.search" text="Use as" size="sm">
			<b-dropdown-item href="javascript:" @click="$emit('use-as-from')">Route start</b-dropdown-item>
			<b-dropdown-item href="javascript:" @click="$emit('use-as-via')">Route via</b-dropdown-item>
			<b-dropdown-item href="javascript:" @click="$emit('use-as-to')">Route destination</b-dropdown-item>
		</b-dropdown>
	</b-button-toolbar>
</div>