<div class="fm-overpass-info">
	<h2>
		<a v-if="showBackButton" href="javascript:" @click="$emit('back')"><Icon icon="arrow-left"></Icon></a>
		{{element.tags.name || 'Unnamed POI'}}
	</h2>
	<dl class="fm-search-box-collapse-point">
		<template v-for="(value, key) in element.tags">
			<dt>{{key}}</dt>
			<dd v-html="renderOsmTag(key, value)"></dd>
		</template>
	</dl>

	<b-button-toolbar>
		<b-button v-b-tooltip.hover="'Zoom to POI'" @click="zoomToElement()" size="sm"><Icon icon="zoom-in" alt="Zoom to POI"></Icon></b-button>

		<b-dropdown v-if="!client.readonly && types.length > 0" :disabled="isAdding" size="sm">
			<template #button-content>
				<b-spinner small v-if="isAdding"></b-spinner>
				Add to map
			</template>
			<b-dropdown-item v-for="type in types" href="javascript:" @click="$emit('add-to-map', type)">{{type.name}}</b-dropdown-item>
		</b-dropdown>

		<b-dropdown text="Use as" size="sm" v-if="context.search">
			<b-dropdown-item href="javascript:" @click="useAsFrom()">Route start</b-dropdown-item>
			<b-dropdown-item href="javascript:" @click="useAsVia()">Route via</b-dropdown-item>
			<b-dropdown-item href="javascript:" @click="useAsTo()">Route destination</b-dropdown-item>
		</b-dropdown>
	</b-button-toolbar>
</div>