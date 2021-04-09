<FormModal
	:id="id"
	title="Edit Type"
	dialog-class="fm-edit-type"
	:is-saving="isSaving"
	:is-modified="isModified"
	:is-create="isCreate"
	@submit="save"
	@hidden="clear"
	@show="initialize"
>
	<template v-if="type">
		<ValidationProvider name="Name" v-slot="v" rules="required">
			<b-form-group label="Name" label-for="fm-edit-type-name-input" label-cols-sm="3" :state="v | validationState">
				<b-input id="fm-edit-type-name-input" v-model="type.name" :state="v | validationState"></b-input>
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
			</b-form-group>
		</ValidationProvider>

		<ValidationProvider name="Type" v-slot="v" rules="required">
			<b-form-group label="Type" label-for="fm-edit-type-type-input" label-cols-sm="3" :state="v | validationState">
				<b-form-select
					id="fm-edit-type-type-input"
					v-model="type.type"
					:disabled="!isCreate"
					:options="[{ value: 'marker', text: 'Marker' }, { value: 'line', text: 'Line' }]"
					:state="v | validationState"
				></b-form-select>
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
			</b-form-group>
		</ValidationProvider>

		<ValidationProvider name="Default colour" v-slot="v" :rules="type.colourFixed ? 'required|colour' : 'colour'">
			<b-form-group label="Default colour" label-for="fm-edit-type-default-color-input" label-cols-sm="3" :state="v | validationState">
				<b-row align-v="center">
					<b-col><ColourField id="fm-edit-type-default-colour-input" v-model="type.defaultColour" :disabled="!canControl('colour')" :state="v | validationState"></ColourField></b-col>
					<b-col sm="3"><b-checkbox v-model="type.colourFixed" :disabled="!canControl('colour')" @change="setTimeout(() => { v.validate(type.defaultColour); })">Fixed</b-checkbox></b-col>
				</b-row>
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
			</b-form-group>
		</ValidationProvider>

		<ValidationProvider v-if="type.type == 'marker'" name="Default size" v-slot="v" :rules="type.sizeFixed ? 'required|size' : 'size'">
			<b-form-group label="Default size" label-for="fm-edit-type-default-size-input" label-cols-sm="3" :state="v | validationState">
				<b-row align-v="center">
					<b-col><SizeField id="fm-edit-type-default-size-input" v-model="type.defaultSize" :disabled="!canControl('size')" :state="v | validationState"></SizeField></b-col>
					<b-col sm="3"><b-checkbox v-model="type.sizeFixed" :disabled="!canControl('size')" @change="setTimeout(() => { v.validate(type.defaultSize); })">Fixed</b-checkbox></b-col>
				</b-row>
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
			</b-form-group>
		</ValidationProvider>

		<ValidationProvider v-if="type.type == 'marker'" name="Default icon" v-slot="v" rules="symbol">
			<b-form-group label="Default icon" label-for="fm-edit-type-default-symbol-input" label-cols-sm="3" :state="v | validationState">
				<b-row align-v="center">
					<b-col><SymbolField id="fm-edit-type-default-symbol-input" v-model="type.defaultSymbol" :disabled="!canControl('symbol')" :state="v | validationState"></SymbolField></b-col>
					<b-col sm="3"><b-checkbox v-model="type.symbolFixed" :disabled="!canControl('symbol')" @change="setTimeout(() => { v.validate(type.defaultSymbol); })">Fixed</b-checkbox></b-col>
				</b-row>
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
			</b-form-group>
		</ValidationProvider>

		<ValidationProvider v-if="type.type == 'marker'" name="Default shape" v-slot="v" rules="shape">
			<b-form-group label="Default shape" label-for="fm-edit-type-default-shape-input" label-cols-sm="3" :state="v | validationState">
				<b-row align-v="center">
					<b-col><ShapeField id="fm-edit-type-default-shape-input" v-model="type.defaultShape" :disabled="!canControl('shape')" :state="v | validationState"></ShapeField></b-col>
					<b-col sm="3"><b-checkbox v-model="type.shapeFixed" :disabled="!canControl('shape')" @change="setTimeout(() => { v.validate(type.defaultShape); })">Fixed</b-checkbox></b-col>
				</b-row>
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
			</b-form-group>
		</ValidationProvider>

		<ValidationProvider v-if="type.type == 'line'" name="Default width" v-slot="v" :rules="type.widthFixed ? 'required|width' : 'width'">
			<b-form-group label="Default width" label-for="fm-edit-type-default-width-input" label-cols-sm="3" :state="v | validationState">
				<b-row align-v="center">
					<b-col><WidthField id="fm-edit-type-default-width-input" v-model="type.defaultWidth" :disabled="!canControl('width')" :state="v | validationState"></WidthField></b-col>
					<b-col sm="3"><b-checkbox v-model="type.widthFixed" :disabled="!canControl('width')" @change="setTimeout(() => { v.validate(type.defaultWidth); })">Fixed</b-checkbox></b-col>
				</b-row>
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
			</b-form-group>
		</ValidationProvider>

		<ValidationProvider v-if="type.type == 'line'" name="Default routing mode" v-slot="v" :rules="type.modeFixed ? 'required' : ''">
			<b-form-group label="Default routing mode" label-for="fm-edit-type-default-mode-input" label-cols-sm="3" :state="v | validationState">
				<b-row align-v="center">
					<b-col><RouteMode id="fm-edit-type-default-mode-input" v-model="type.defaultMode" :disabled="!canControl('mode')" min="1"></RouteMode></b-col>
					<b-col sm="3"><b-checkbox v-model="type.modeFixed" :disabled="!canControl('mode')" @change="setTimeout(() => { v.validate(type.defaultMode); })">Fixed</b-checkbox></b-col>
				</b-row>
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
			</b-form-group>
		</ValidationProvider>

		<b-form-group label="Legend" label-for="fm-edit-type-show-in-legend-input" label-cols-sm="3" label-class="pt-0">
			<b-checkbox v-model="type.showInLegend">Show in legend</b-checkbox>
		</b-form-group>

		<h2>Fields</h2>
		<b-table-simple striped hover responsive>
			<b-thead>
				<b-tr>
					<b-th style="width: 35%; min-width: 150px">Name</b-th>
					<b-th style="width: 35%; min-width: 120px">Type</b-th>
					<b-th style="width: 35%; min-width: 150px">Default value</b-th>
					<b-th>Delete</b-th>
					<b-th></b-th>
				</b-tr>
			</b-thead>
			<draggable v-model="type.fields" tag="tbody" handle=".fm-drag-handle">
				<b-tr v-for="field in type.fields">
					<b-td>
						<ValidationProvider :name="`Field name (${field.name})`" v-slot="v" rules="required|uniqueFieldName:@type">
							<b-form-group :state="v | validationState">
								<b-input v-model="field.name" :state="v | validationState" />
								<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
							</b-form-group>
						</ValidationProvider>
					</b-td>
					<b-td>
						<b-input-group>
							<b-form-select
								v-model="field.type"
								:options="[{ value: 'input', text: 'Text field' }, { value: 'textarea', text: 'Text area' }, { value: 'dropdown', text: 'Dropdown' }, { value: 'checkbox', text: 'Checkbox' }]"
							></b-form-select>
							<b-input-group-append v-if="['dropdown', 'checkbox'].includes(field.type)">
								<b-button @click="editDropdown(field)">Edit</b-button>
							</b-input-group-append>
						</b-input-group>
					</b-td>
					<b-td class="text-center">
						<FieldInput :field="field" v-model="field.default" ignore-default></FieldInput>
					</b-td>
					<b-td class="td-buttons">
						<b-button @click="deleteField(field)">Delete</b-button>
					</b-td>
					<b-td class="td-buttons">
						<b-button class="fm-drag-handle"><Icon icon="resize-vertical" alt="Reorder"></Icon></b-button>
					</b-td>
				</b-tr>
			</draggable>
			<b-tfoot>
				<b-tr>
					<b-td colspan="4">
						<b-button @click="createField()"><Icon icon="plus" alt="Add"></Icon></b-button>
					</b-td>
					<b-td class="move"></b-td>
				</b-tr>
			</b-tfoot>
		</b-table-simple>

		<ValidationProvider vid="type" ref="typeValidationProvider" v-slot="v" rules="" immediate>
			<b-form-group :state="v | validationState">
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
			</b-form-group>
		</ValidationProvider>

		<EditTypeDropdown v-if="editField != null" id="fm-edit-type-dropdown" :type="type" :field="editField"></EditTypeDropdown>
	</template>
</FormModal>