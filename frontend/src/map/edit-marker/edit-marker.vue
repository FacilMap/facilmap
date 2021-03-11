<FormModal
	:id="id"
	title="Edit Marker"
	dialog-class="fm-edit-marker"
	:is-saving="isSaving"
	:is-modified="isModified"
	@submit="save"
	@show="initialize"
>
	<template v-if="marker">
		<b-form-group label="Name" label-for="fm-edit-marker-name-input" label-cols-sm="3">
			<b-form-input id="fm-edit-marker-name-input" v-model="marker.name"></b-form-input>
		</b-form-group>

		<ValidationProvider v-if="canControl('colour')" name="Colour" v-slot="v" rules="colour">
			<b-form-group label="Colour" label-for="fm-edit-marker-colour-input" label-cols-sm="3" :state="v | validationState">
				<ColourField id="fm-edit-marker-colour-input" v-model="marker.colour" :state="v | validationState"></ColourField>
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
			</b-form-group>
		</ValidationProvider>

		<ValidationProvider v-if="canControl('size')" name="Size" v-slot="v" rules="size">
			<b-form-group label="Size" label-for="fm-edit-marker-size-input" label-cols-sm="3">
				<SizeField id="fm-edit-marker-size-input" v-model="marker.size"></SizeField>
			</b-form-group>
		</ValidationProvider>

		<ValidationProvider v-if="canControl('symbol')" name="Icon" v-slot="v" rules="symbol">
			<b-form-group label="Icon" label-for="fm-edit-marker-symbol-input" label-cols-sm="3" :state="v | validationState">
				<SymbolField id="fm-edit-marker-symbol-input" v-model="marker.symbol" :state="v | validationState"></SymbolField>
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
			</b-form-group>
		</ValidationProvider>

		<ValidationProvider v-if="canControl('shape')" name="Shape" v-slot="v" rules="shape">
			<b-form-group label="Shape" label-for="fm-edit-marker-shape-input" label-cols-sm="3" :state="v | validationState">
				<ShapeField id="fm-edit-marker-shape-input" v-model="marker.shape" :state="v | validationState"></ShapeField>
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
			</b-form-group>
		</ValidationProvider>

		<b-form-group v-for="(field, idx in client.types[marker.typeId].fields" :label="field.name" :label-for="`fm-edit-marker-${idx}-input`" label-cols-sm="3">
			<FieldInput :id="`fm-edit-marker-${idx}-input`" :field="field" v-model="marker.data[field.name]"></FieldInput>
		</b-form-group>
	</template>

	<template #footer-left>
		<b-dropdown dropup v-if="types.length > 1" text="Change type">
			<b-dropdown-item v-for="type in types" :active="type.id == marker.typeId" @click="marker.typeId = type.id">{{type.name}}</b-dropdown-item>
		</b-dropdown>
	</template>
</FormModal>