<FormModal
	:id="id"
	title="Save current view"
	dialog-class="fm-save-view"
	:is-saving="isSaving"
	:is-create="true"
	@submit="save"
	@show="initialize"
>
	<template v-if="view">
		<ValidationProvider name="Editable link" v-slot="v" rules="required">
			<b-form-group label="Name" label-for="name-input" label-cols-sm="3" :invalid-feedback="v.errors[0]" :state="v | validationState">
				<b-form-input id="name-input" v-model="view.name" :state="v | validationState" autofocus></b-form-input>
			</b-form-group>
		</ValidationProvider>

		<b-form-group label="Top left" label-for="topleft-input" label-cols-sm="3">
			<b-form-input id="topleft-input" :value="`${$options.filters.round(view.top, 5)}, ${$options.filters.round(view.left, 5)}`" plaintext></b-form-input>
		</b-form-group>

		<b-form-group label="Bottom right" label-for="bottomright-input" label-cols-sm="3">
			<b-form-input id="bottomright-input" :value="`${$options.filters.round(view.bottom, 5)}, ${$options.filters.round(view.right, 5)}`" plaintext></b-form-input>
		</b-form-group>

		<b-form-group label="Base layer" label-for="base-layer-input" label-cols-sm="3">
			<b-form-input id="base-layer-input" :value="baseLayer" plaintext></b-form-input>
		</b-form-group>

		<b-form-group label="Overlays" label-for="overlays-input" label-cols-sm="3">
			<b-form-input id="overlays-input" :value="overlays" plaintext></b-form-input>
		</b-form-group>

		<b-form-group v-if="!filter" label="Filter" label-for="filter-input" label-cols-sm="3">
			<b-form-input id="filter-input" value="—" plaintext></b-form-input>
		</b-form-group>

		<div v-if="filter" class="form-group row">
			<div class="col-sm-3">Filter</div>
			<div class="col-sm-9">
				<b-form-checkbox checked="!!view.filter" @input="view.filter = ($event ? filter : undefined)">
					Save current filter (<code>{{filter}}</code>
				</b-form-checkbox>
			</div>
		</div>

		<div class="form-group row">
			<div class="col-sm-3">Default view</div>
			<div class="col-sm-9">
				<b-form-checkbox v-model="makeDefault">Make default view</b-form-checkbox>
			</div>
		</div>
	</template>
</FormModal>