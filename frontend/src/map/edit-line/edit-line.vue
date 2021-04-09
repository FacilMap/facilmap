<FormModal
	:id="id"
	title="Edit Line"
	dialog-class="fm-edit-line"
	:is-saving="isSaving"
	:is-modified="isModified"
	@submit="save"
	@hidden="clear"
	@show="initialize"
>
	<template v-if="line">
		<b-form-group label="Name" label-for="fm-edit-line-name-input" label-cols-sm="3">
			<b-form-input id="fm-edit-line-name-input" v-model="line.name"></b-form-input>
		</b-form-group>

		<b-form-group label="Routing mode" v-if="canControl('mode') && line.mode != 'track'" label-cols-sm="3">
			<RouteMode v-model="line.mode"></RouteMode>
		</b-form-group>

		<ValidationProvider v-if="canControl('colour')" name="Colour" v-slot="v" rules="required|colour">
			<b-form-group label="Colour" label-for="fm-edit-line-colour-input" label-cols-sm="3" :state="v | validationState">
				<ColourField id="fm-edit-line-colour-input" v-model="line.colour" :state="v | validationState"></ColourField>
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
			</b-form-group>
		</ValidationProvider>

		<ValidationProvider v-if="canControl('width')" name="Width" v-slot="v" rules="width">
			<b-form-group label="Width" label-for="fm-edit-line-width-input" label-cols-sm="3">
				<WidthField id="fm-edit-line-width-input" v-model="line.width"></WidthField>
			</b-form-group>
		</ValidationProvider>

		<b-form-group v-for="(field, idx in client.types[line.typeId].fields" :label="field.name" :label-for="`fm-edit-line-${idx}-input`" label-cols-sm="3">
			<FieldInput :id="`fm-edit-line-${idx}-input`" :field="field" :value="line.data.get(field.name)" @input="line.data.set(field.name, $event)"></FieldInput>
		</b-form-group>
	</template>

	<template #footer-left>
		<b-dropdown dropup v-if="types.length > 1" text="Change type">
			<b-dropdown-item v-for="type in types" :active="type.id == line.typeId" @click="line.typeId = type.id">{{type.name}}</b-dropdown-item>
		</b-dropdown>
	</template>
</FormModal>