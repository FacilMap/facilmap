<Picker v-bind="$props" v-on="$listeners" custom-class="fm-shape-field" @keydown="handleKeyDown">
	<template #preview>
		<b-input-group-text><span style="width: 1.4em"><img :src="valueSrc"></span></b-input-group-text>
	</template>

	<template #default="{ close }">
		<b-alert v-if="Object.keys(items).length == 0" show variant="danger" class="mt-2 mb-1">No shapes could be found.</b-alert>

		<PrerenderedList
			:items="items"
			:value="value"
			@click="handleClick($event, close)"
			ref="grid"
		></PrerenderedList>
	</template>
</Picker>