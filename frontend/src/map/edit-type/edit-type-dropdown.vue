<FormModal
	:id="id"
	:title="fieldValue && `Edit ${fieldValue.type == 'checkbox' ? 'Checkbox' : 'Dropdown'}`"
	dialog-class="fm-edit-type-dropdown"
	:is-modified="isModified"
	@submit="save"
	@show="initialize"
	:size="fieldValue && controlNumber > 2 ? 'xl' : 'lg'"
	ok-title="OK"
>
	<template v-if="fieldValue">
		<b-form-group label="Control" label-cols-sm="3">
			<b-checkbox v-model="fieldValue.controlColour" :disabled="!canControl('colour')">Control {{type.type}} colour</b-checkbox>
			<b-checkbox v-if="type.type == 'marker'" v-model="fieldValue.controlSize" :disabled="!canControl('size')">Control {{type.type}} size</b-checkbox>
			<b-checkbox v-if="type.type == 'marker'" v-model="fieldValue.controlSymbol" :disabled="!canControl('symbol')">Control {{type.type}} icon</b-checkbox>
			<b-checkbox v-if="type.type == 'marker'" v-model="fieldValue.controlShape" :disabled="!canControl('shape')">Control {{type.type}} shape</b-checkbox>
			<b-checkbox v-if="type.type == 'line'" v-model="fieldValue.controlWidth" :disabled="!canControl('width')">Control {{type.type}} width</b-checkbox>
		</b-form-group>
		<b-table-simple striped hover v-if="fieldValue.type != 'checkbox' || controlNumber > 0">
			<b-thead>
				<b-tr>
					<b-th>Option</b-th>
					<b-th v-if="fieldValue.type == 'checkbox'">Label (for legend)</b-th>
					<b-th v-if="fieldValue.controlColour">Colour</b-th>
					<b-th v-if="fieldValue.controlSize">Size</b-th>
					<b-th v-if="fieldValue.controlSymbol">Icon</b-th>
					<b-th v-if="fieldValue.controlShape">Shape</b-th>
					<b-th v-if="fieldValue.controlWidth">Width</b-th>
					<b-th v-if="fieldValue.type != 'checkbox'"></b-th>
					<b-th v-if="fieldValue.type != 'checkbox'" class="move"></b-th>
				</b-tr>
			</b-thead>
			<draggable v-model="fieldValue.options" tag="tbody" handle=".fm-drag-handle">
				<b-tr v-for="(option, idx) in fieldValue.options">
					<b-td v-if="fieldValue.type == 'checkbox'">
						<strong>{{idx === 0 ? '✘' : '✔'}}</strong>
					</b-td>
					<b-td class="field">
						<ValidationProvider :name="`Label (${option.value})`" v-slot="v" :rules="fieldValue.type == 'checkbox' ? '' : 'required|uniqueFieldOptionValue:@field'">
							<b-form-group :state="v | validationState">
								<b-input v-model="option.value" :state="v | validationState"></b-input>
								<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
							</b-form-group>
						</ValidationProvider>
					</b-td>
					<b-td v-if="fieldValue.controlColour" class="field">
						<ValidationProvider :name="`Colour (${option.value})`" v-slot="v" rules="required|colour">
							<b-form-group :state="v | validationState">
								<ColourField v-model="option.colour" :state="v | validationState"></ColourField>
								<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
							</b-form-group>
						</ValidationProvider>
					</b-td>
					<b-td v-if="fieldValue.controlSize" class="field">
						<ValidationProvider :name="`Size (${option.value})`" v-slot="v" rules="required|size">
							<b-form-group :state="v | validationState">
								<SizeField v-model="option.size" :state="v | validationState"></SizeField>
								<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
							</b-form-group>
						</ValidationProvider>
					</b-td>
					<b-td v-if="fieldValue.controlSymbol" class="field">
						<ValidationProvider :name="`Icon (${option.value})`" v-slot="v" rules="required|symbol">
							<b-form-group :state="v | validationState">
								<SymbolField v-model="option.symbol" :state="v | validationState"></SymbolField>
								<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
							</b-form-group>
						</ValidationProvider>
					</b-td>
					<b-td v-if="fieldValue.controlShape" class="field">
						<ValidationProvider :name="`Shape (${option.value})`" v-slot="v" rules="required|shape">
							<b-form-group :state="v | validationState">
								<ShapeField v-model="option.shape" :state="v | validationState"></ShapeField>
								<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
							</b-form-group>
						</ValidationProvider>
					</b-td>
					<b-td v-if="fieldValue.controlWidth" class="field">
						<ValidationProvider :name="`Width (${option.value})`" v-slot="v" rules="required|width">
							<b-form-group :state="v | validationState">
								<WidthField v-model="option.width" :state="v | validationState"></WidthField>
								<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
							</b-form-group>
						</ValidationProvider>
					</b-td>
					<b-td v-if="fieldValue.type != 'checkbox'" class="td-buttons">
						<b-button @click="deleteOption(option)"><Icon icon="minus" alt="Remove"></Icon></b-button>
					</b-td>
					<b-td v-if="fieldValue.type != 'checkbox'" class="td-buttons">
						<b-button class="fm-drag-handle"><Icon icon="resize-vertical" alt="Reorder"></Icon></b-button>
					</b-td>
				</b-tr>
			</draggable>
			<b-tfoot v-if="fieldValue.type != 'checkbox'">
				<b-tr>
					<b-td><b-button @click="addOption()"><Icon icon="plus" alt="Add"></Icon></b-button></b-td>
				</b-tr>
			</b-tfoot>
		</b-table-simple>

		<ValidationProvider vid="field" ref="fieldValidationProvider" v-slot="v" rules="fieldOptionNumber" immediate>
			<b-form-group :state="v | validationState">
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
			</b-form-group>
		</ValidationProvider>
	</template>
</FormModal>