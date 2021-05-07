<Picker v-bind="$props" v-on="$listeners" custom-class="fm-symbol-field" expand @keydown="handleKeyDown">
	<template #preview>
		<b-input-group-text><Icon :icon="value"></Icon></b-input-group-text>
	</template>

	<template #default="{ close }">
		<b-input type="search" v-model="filter" placeholder="Filter" autocomplete="off" autofocus></b-input>

		<b-alert v-if="Object.keys(items).length == 0" show variant="danger" class="mt-2 mb-1">No icons could be found.</b-alert>

		<PrerenderedList
			:items="items"
			:value="value"
			@click="handleClick($event, close)"
			ref="grid"
		></PrerenderedList>
	</template>
</Picker>