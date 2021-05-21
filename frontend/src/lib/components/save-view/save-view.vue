<FormModal
	:id="id"
	title="Save current view"
	dialog-class="fm-save-view"
	:is-saving="isSaving"
	:is-create="true"
	@submit="save"
	@show="initialize"
>
	<ValidationProvider name="Editable link" v-slot="v" rules="required">
		<b-form-group label="Name" :label-for="`${id}-name-input`" label-cols-sm="3" :state="v | validationState">
			<b-form-input :id="`${id}-name-input`" v-model="name" :state="v | validationState" autofocus></b-form-input>
			<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
		</b-form-group>
	</ValidationProvider>

	<b-form-group label="Top left" :label-for="`${id}-topleft-input`" label-cols-sm="3">
		<b-form-input :id="`${id}-topleft-input`" :value="`${$options.filters.round(mapContext.bounds.getNorth(), 5)}, ${$options.filters.round(mapContext.bounds.getWest(), 5)}`" plaintext></b-form-input>
	</b-form-group>

	<b-form-group label="Bottom right" :label-for="`${id}-bottomright-input`" label-cols-sm="3">
		<b-form-input :id="`${id}-bottomright-input`" :value="`${$options.filters.round(mapContext.bounds.getSouth(), 5)}, ${$options.filters.round(mapContext.bounds.getEast(), 5)}`" plaintext></b-form-input>
	</b-form-group>

	<b-form-group label="Base layer" :label-for="`${id}-base-layer-input`" label-cols-sm="3">
		<b-form-input :id="`${id}-base-layer-input`" :value="baseLayer" plaintext></b-form-input>
	</b-form-group>

	<b-form-group label="Overlays" :label-for="`${id}-overlays-input`" label-cols-sm="3">
		<b-form-input :id="`${id}-overlays-input`" :value="overlays" plaintext></b-form-input>
	</b-form-group>

	<b-form-group
		v-if="mapContext.overpassIsCustom ? !mapContext.overpassCustom : mapContext.overpassPresets.length == 0"
		label="POIs"
		:label-for="`${id}-overpass-input`"
		label-cols-sm="3"
	>
		<b-form-input :id="`${id}-overpass-input`" value="—" plaintext></b-form-input>
	</b-form-group>

	<b-form-group v-else label="POIs" :label-for="`${id}-overpass-input`" label-cols-sm="3" label-class="pt-0">
		<b-form-checkbox :id="`${id}-overpass-input`" v-model="includeOverpass">
			Include POIs (<code v-if="mapContext.overpassIsCustom">{{mapContext.overpassCustom}}</code><template v-else>{{mapContext.overpassPresets.map((p) => p.label).join(', ')}}</template>)
		</b-form-checkbox>
	</b-form-group>

	<b-form-group v-if="!mapContext.filter" label="Filter" :label-for="`${id}-filter-input`" label-cols-sm="3">
		<b-form-input :id="`${id}-filter-input`" value="—" plaintext></b-form-input>
	</b-form-group>

	<b-form-group v-else label="Filter" :label-for="`${id}-filter-checkbox`" label-cols-sm="3" label-class="pt-0">
		<b-form-checkbox :id="`${id}-filter-checkbox`" v-model="includeFilter">
			Include current filter (<code>{{mapContext.filter}}</code>)
		</b-form-checkbox>
	</b-form-group>

	<b-form-group label="Default view" :label-for="`${id}-make-default-input`" label-cols-sm="3" label-class="pt-0">
		<b-form-checkbox :id="`${id}-make-default-input`" v-model="makeDefault">Make default view</b-form-checkbox>
	</b-form-group>
</FormModal>