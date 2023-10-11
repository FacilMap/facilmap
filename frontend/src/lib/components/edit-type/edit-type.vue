<script setup lang="ts">
	import { Field, ID, Line, Marker, Type, TypeUpdate } from "facilmap-types";
	import { clone } from "facilmap-utils";
	import { canControl, IdType } from "../../utils/utils";
	import { mergeTypeObject } from "./edit-type-utils";
	import { isEqual } from "lodash-es";
	import { showErrorToast } from "../ui/toasts/toasts.vue";
	import Modal from "../ui/modal/modal.vue";
	import ColourField from "../ui/colour-field/colour-field";
	import ShapeField from "../ui/shape-field/shape-field";
	import SymbolField from "../ui/symbol-field/symbol-field";
	import RouteMode from "../ui/route-mode/route-mode";
	import draggable from "vuedraggable";
	import FieldInput from "../ui/field-input/field-input";
	import Icon from "../ui/icon/icon";
	import WidthField from "../ui/width-field/width-field";
	import SizeField from "../ui/size-field/size-field";
	import EditTypeDropdown from "./edit-type-dropdown";
	import { Context } from "../facilmap/facilmap";

	extend("uniqueFieldName", {
		validate: (value: string, args: any) => {
			const type: Type | undefined = args.type;
			return !type || type.fields.filter((field) => field.name == value).length <= 1;
		},
		message: "Multiple fields cannot have the same name.",
		params: ["type"]
	});

	@WithRender
	@Component({
		components: { ColourField, draggable, EditTypeDropdown, FieldInput, FormModal, Icon, RouteMode, ShapeField, SizeField, SymbolField, ValidationProvider, WidthField }
	})
	export default class EditType extends Vue {

		@InjectContext() context!: Context;
		@InjectClient() client!: Client;

		@Ref() typeValidationProvider?: InstanceType<typeof ValidationProvider>;

		@Prop({ type: String, required: true }) id!: string;
		@Prop({ type: IdType }) typeId?: ID;

		type: Type & TypeUpdate = null as any;
		isSaving = false;
		editField: Field | null = null;

		setTimeout(func: () => void): void {
			setTimeout(func, 0);
		}

		initialize(): void {
			this.type = clone(this.initialType);
		}

		clear(): void {
			this.type = null as any;
		}

		get initialType(): Type & TypeUpdate {
			const type = this.isCreate ? { fields: [] } as any : clone(this.originalType)!;

			for(const field of type.fields) {
				field.oldName = field.name;
			}

			return type;
		}

		get isModified(): boolean {
			return !isEqual(this.type, this.initialType);
		}

		get isCreate(): boolean {
			return this.typeId == null;
		}

		get originalType(): Type | undefined {
			return this.typeId != null ? this.client.types[this.typeId] : undefined;
		}

		get canControl(): Array<keyof Marker | keyof Line> {
			return canControl(this.type, null);
		}

		@Watch("originalType")
		handleChangeType(newType: Type | undefined, oldType: Type): void {
			if (this.type) {
				if (!newType) {
					this.$bvModal.hide(this.id);
					// TODO: Show message
				} else {
					mergeTypeObject(oldType, newType, this.type);
				}
			}
		}

		@Watch("type", { deep: true })
		handleChange(type: TypeUpdate): void {
			this.typeValidationProvider?.validate({ ...type });
		}

		createField(): void {
			this.type.fields.push({ name: "", type: "input", "default": "" });
		}

		async deleteField(field: Field): Promise<void> {
			if (!await this.$bvModal.msgBoxConfirm(`Do you really want to delete the field “${field.name}”?`))
				return;

			var idx = this.type.fields.indexOf(field);
			if(idx != -1)
				this.type.fields.splice(idx, 1);
		}

		async save(): Promise<void> {
			this.$bvToast.hide(`fm${this.context.id}-edit-type-error`);
			this.isSaving = true;

			for (const prop of [ "defaultWidth", "defaultSize", "defaultColour" ] as Array<"defaultWidth" | "defaultSize" | "defaultColour">) {
				if(this.type[prop] == "")
					this.type[prop] = null;
			}

			try {
				if (this.isCreate)
					await this.client.addType(this.type);
				else
					await this.client.editType(this.type);

				this.$bvModal.hide(this.id);
			} catch (err) {
				showErrorToast(this, `fm${this.context.id}-edit-type-error`, this.isCreate ? "Error creating type" : "Error saving type", err);
			} finally {
				this.isSaving = false;
			}
		}

		editDropdown(field: Field): void {
			this.editField = field;
			setTimeout(() => { this.$bvModal.show(`${this.id}-dropdown`); }, 0);
		}

	}

</script>

<template>
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
				<b-form-group label="Name" :label-for="`${id}-name-input`" label-cols-sm="3" :state="v | validationState">
					<b-input :id="`${id}-name-input`" v-model="type.name" :state="v | validationState"></b-input>
					<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
				</b-form-group>
			</ValidationProvider>

			<ValidationProvider name="Type" v-slot="v" rules="required">
				<b-form-group label="Type" :label-for="`${id}-type-input`" label-cols-sm="3" :state="v | validationState">
					<b-form-select
						:id="`${id}-type-input`"
						v-model="type.type"
						:disabled="!isCreate"
						:options="[{ value: 'marker', text: 'Marker' }, { value: 'line', text: 'Line' }]"
						:state="v | validationState"
					></b-form-select>
					<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
				</b-form-group>
			</ValidationProvider>

			<template v-if="canControl.length > 0">
				<hr/>

				<p class="text-muted">
					These styles are applied when a new object of this type is created. If “Fixed” is enabled, the style is applied to all objects
					of this type and cannot be changed for an individual object anymore. For more complex style control, dropdown or checkbox fields
					can be configured below to change the style based on their selected value.
				</p>

				<ValidationProvider v-if="canControl.includes('colour')" name="Default colour" v-slot="v" :rules="type.colourFixed ? 'required|colour' : 'colour'">
					<b-form-group label="Default colour" :label-for="`${id}-default-color-input`" label-cols-sm="3" :state="v | validationState">
						<b-row align-v="center">
							<b-col><ColourField :id="`${id}-default-colour-input`" v-model="type.defaultColour" :state="v | validationState"></ColourField></b-col>
							<b-col sm="3"><b-checkbox v-model="type.colourFixed" @change="setTimeout(() => { v.validate(type.defaultColour); })">Fixed</b-checkbox></b-col>
						</b-row>
						<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
					</b-form-group>
				</ValidationProvider>

				<ValidationProvider v-if="canControl.includes('size')" name="Default size" v-slot="v" :rules="type.sizeFixed ? 'required|size' : 'size'">
					<b-form-group label="Default size" :label-for="`${id}-default-size-input`" label-cols-sm="3" :state="v | validationState">
						<b-row align-v="center">
							<b-col><SizeField :id="`${id}-default-size-input`" v-model="type.defaultSize" :state="v | validationState"></SizeField></b-col>
							<b-col sm="3"><b-checkbox v-model="type.sizeFixed" @change="setTimeout(() => { v.validate(type.defaultSize); })">Fixed</b-checkbox></b-col>
						</b-row>
						<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
					</b-form-group>
				</ValidationProvider>

				<ValidationProvider v-if="canControl.includes('symbol')" name="Default icon" v-slot="v" rules="symbol">
					<b-form-group label="Default icon" :label-for="`${id}-default-symbol-input`" label-cols-sm="3" :state="v | validationState">
						<b-row align-v="center">
							<b-col><SymbolField :id="`${id}-default-symbol-input`" v-model="type.defaultSymbol" :state="v | validationState"></SymbolField></b-col>
							<b-col sm="3"><b-checkbox v-model="type.symbolFixed" @change="setTimeout(() => { v.validate(type.defaultSymbol); })">Fixed</b-checkbox></b-col>
						</b-row>
						<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
					</b-form-group>
				</ValidationProvider>

				<ValidationProvider v-if="canControl.includes('shape')" name="Default shape" v-slot="v" rules="shape">
					<b-form-group label="Default shape" :label-for="`${id}-default-shape-input`" label-cols-sm="3" :state="v | validationState">
						<b-row align-v="center">
							<b-col><ShapeField :id="`${id}-default-shape-input`" v-model="type.defaultShape" :state="v | validationState"></ShapeField></b-col>
							<b-col sm="3"><b-checkbox v-model="type.shapeFixed" @change="setTimeout(() => { v.validate(type.defaultShape); })">Fixed</b-checkbox></b-col>
						</b-row>
						<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
					</b-form-group>
				</ValidationProvider>

				<ValidationProvider v-if="canControl.includes('width')" name="Default width" v-slot="v" :rules="type.widthFixed ? 'required|width' : 'width'">
					<b-form-group label="Default width" :label-for="`${id}-default-width-input`" label-cols-sm="3" :state="v | validationState">
						<b-row align-v="center">
							<b-col><WidthField :id="`${id}-default-width-input`" v-model="type.defaultWidth" :state="v | validationState"></WidthField></b-col>
							<b-col sm="3"><b-checkbox v-model="type.widthFixed" @change="setTimeout(() => { v.validate(type.defaultWidth); })">Fixed</b-checkbox></b-col>
						</b-row>
						<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
					</b-form-group>
				</ValidationProvider>

				<ValidationProvider v-if="canControl.includes('mode')" name="Default routing mode" v-slot="v" :rules="type.modeFixed ? 'required' : ''">
					<b-form-group label="Default routing mode" :label-for="`${id}-default-mode-input`" label-cols-sm="3" :state="v | validationState">
						<b-row align-v="center">
							<b-col><RouteMode :id="`${id}-default-mode-input`" v-model="type.defaultMode" min="1"></RouteMode></b-col>
							<b-col sm="3"><b-checkbox v-model="type.modeFixed" @change="setTimeout(() => { v.validate(type.defaultMode); })">Fixed</b-checkbox></b-col>
						</b-row>
						<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
					</b-form-group>
				</ValidationProvider>

				<hr/>
			</template>

			<b-form-group label="Legend" :label-for="`${id}-show-in-legend-input`" label-cols-sm="3" label-class="pt-0">
				<b-checkbox v-model="type.showInLegend">Show in legend</b-checkbox>
				<template #description>
					An item for this type will be shown in the legend. Any fixed style attributes are applied to it. Dropdown or checkbox fields that control the style generate additional legend items.
				</template>
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

			<EditTypeDropdown v-if="editField != null" :id="`${id}-dropdown`" :type="type" :field="editField"></EditTypeDropdown>
		</template>
	</FormModal>
</template>