<script setup lang="ts">
	import WithRender from "./edit-type-dropdown.vue";
	import Vue from "vue";
	import { Component, Prop, Ref, Watch } from "vue-property-decorator";
	import { Field, FieldOptionUpdate, FieldUpdate, Line, Marker, Type } from "facilmap-types";
	import { clone } from "facilmap-utils";
	import { canControl, mergeObject } from "../../utils/utils";
	import { isEqual } from "lodash-es";
	import { showErrorToast } from "../../utils/toasts";
	import ColourField from "../ui/colour-field/colour-field";
	import draggable from "vuedraggable";
	import Icon from "../ui/icon/icon";
	import FormModal from "../ui/modal/modal";
	import ShapeField from "../ui/shape-field/shape-field";
	import SizeField from "../ui/size-field/size-field";
	import SymbolField from "../ui/symbol-field/symbol-field";
	import WidthField from "../ui/width-field/width-field";
	import { extend, ValidationProvider } from "vee-validate";
	import "./edit-type-dropdown.scss";
	import { Context } from "../facilmap/facilmap";
	import { InjectContext } from "../../utils/decorators";

	extend("uniqueFieldOptionValue", {
		validate: (value: string, args: any) => {
			const field: Field | undefined = args.field?.field;
			return !field || field.options!.filter((option) => option.value == value).length <= 1;
		},
		message: "Multiple options cannot have the same label.",
		params: ["field"],
		computesRequired: true // To check empty values as well
	});

	extend("fieldOptionNumber", {
		validate: ({ field, type }: { field: FieldUpdate, type: Type }, args: any) => {
			return getControlNumber(type, field) == 0 || (!!field.options && field.options.length > 0);
		},
		message: "Controlling fields need to have at least one option.",
		params: ["controlNumber"]
	});

	function getControlNumber(type: Type, field: FieldUpdate): number {
		return [
			field.controlColour,
			...(type.type == "marker" ? [
				field.controlSize,
				field.controlSymbol,
				field.controlShape
			] : []),
			...(type.type == "line" ? [
				field.controlWidth
			] : [])
		].filter((v) => v).length;
	}

	@WithRender
	@Component({
		components: { ColourField, draggable, Icon, FormModal, ShapeField, SizeField, SymbolField, ValidationProvider, WidthField }
	})
	export default class EditTypeDropdown extends Vue {

		const context = injectContextRequired();

		@Prop({ type: String, required: true }) id!: string;
		@Prop({ type: Object, required: true }) type!: Type;
		@Prop({ type: Object, required: true }) field!: Field;

		@Ref() fieldValidationProvider?: InstanceType<typeof ValidationProvider>;

		fieldValue: FieldUpdate = null as any;

		initialize(): void {
			this.fieldValue = clone(this.initialField);
		}

		clear(): void {
			this.fieldValue = null as any;
		}

		get initialField(): FieldUpdate {
			const field: FieldUpdate = clone(this.field);

			if(field.type == 'checkbox') {
				if(!field.options || field.options.length != 2) {
					field.options = [
						{ value: '' },
						{ value: field.name }
					]
				}

				// Convert legacy format
				if(field.options[0].value == "0")
					field.options[0].value = "";
				if(field.options[1].value == "1")
					field.options[1].value = field.name;
			}

			for(let option of (field.options || []))
				option.oldValue = option.value;

			return field;
		}

		@Watch("field", { deep: true })
		handleFieldChange(newField: Field, oldField: Field): void {
			if (this.fieldValue) {
				if (newField == null) {
					this.$bvModal.hide(this.id);
					// TODO: Show message
				} else {
					mergeObject(oldField, newField, this.fieldValue);
				}
			}
		}

		@Watch("fieldValue", { deep: true })
		handleChange(field: FieldUpdate): void {
			this.fieldValidationProvider?.validate({ type: this.type, field });
		}

		get isModified(): boolean {
			return !isEqual(this.fieldValue, this.initialField);
		}

		get canControl(): Array<keyof Marker | keyof Line> {
			return canControl(this.type, this.field);
		}

		addOption(): void {
			if(this.fieldValue.options == null)
				this.fieldValue.options = [ ];

			this.fieldValue.options!.push({ value: "" });
		}

		async deleteOption(option: FieldOptionUpdate): Promise<void> {
			if (!await this.$bvModal.msgBoxConfirm(`Do you really want to delete the option “${option.value}”?`))
				return;

			var idx = this.fieldValue.options!.indexOf(option);
			if(idx != -1)
				this.fieldValue.options!.splice(idx, 1);
		}

		save(): void {
			this.$bvToast.hide(`fm${this.context.id}-edit-type-dropdown-error`);

			const idx = this.type.fields.indexOf(this.field);
			if (idx === -1)
				toasts.showErrorToast(this, `fm${this.context.id}-edit-type-dropdown-error`, "Error updating field", new Error("The field cannot be found on the type anymore."));
			else {
				Vue.nextTick(() => {
					Vue.set(this.type.fields, idx, this.fieldValue);
				});
				this.$bvModal.hide(this.id);
			}
		}

		get controlNumber(): number {
			return getControlNumber(this.type, this.fieldValue);
		}

	}
</script>

<template>
	<FormModal
		:id="id"
		:title="fieldValue && `Edit ${fieldValue.type == 'checkbox' ? 'Checkbox' : 'Dropdown'}`"
		class="fm-edit-type-dropdown"
		:is-modified="isModified"
		@submit="save"
		@show="initialize"
		@hidden="clear"
		:size="fieldValue && controlNumber > 2 ? 'xl' : 'lg'"
		ok-title="OK"
	>
		<template v-if="fieldValue">
			<div class="row mb-3">
				<label class="col-sm-3 col-form-label">Control</label>
				<div class="col-sm-9">
					<div class="form-check">
						<input
							:id="`${id}-control-colour`"
							class="form-check-input"
							type="checkbox"
							v-model="fieldValue.controlColour"
							:disabled="!canControl.includes('colour')"
						/>
						<label
							class="form-check-label"
							:for="`${id}-control-colour`"
						>
							Control {{type.type}} colour
						</label>
					</div>

					<div v-if="type.type == 'marker'" class="form-check">
						<input
							:id="`${id}-control-size`"
							class="form-check-input"
							type="checkbox"
							v-model="fieldValue.controlSize"
							:disabled="!canControl.includes('size')"
						/>
						<label
							class="form-check-label"
							:for="`${id}-control-size`"
						>
							Control {{type.type}} size
						</label>
					</div>

					<div v-if="type.type == 'marker'" class="form-check">
						<input
							:id="`${id}-control-symbol`"
							class="form-check-input"
							type="checkbox"
							v-model="fieldValue.controlSymbol"
							:disabled="!canControl.includes('symbol')"
						/>
						<label
							class="form-check-label"
							:for="`${id}-control-symbol`"
						>
							Control {{type.type}} icon
						</label>
					</div>

					<div v-if="type.type == 'marker'" class="form-check">
						<input
							:id="`${id}-control-shape`"
							class="form-check-input"
							type="checkbox"
							v-model="fieldValue.controlShape"
							:disabled="!canControl.includes('shape')"
						/>
						<label
							class="form-check-label"
							:for="`${id}-control-shape`"
						>
							Control {{type.type}} shape
						</label>
					</div>

					<div v-if="type.type == 'line'" class="form-check">
						<input
							:id="`${id}-control-width`"
							class="form-check-input"
							type="checkbox"
							v-model="fieldValue.controlWidth"
							:disabled="!canControl.includes('width')"
						/>
						<label
							class="form-check-label"
							:for="`${id}-control-width`"
						>
							Control {{type.type}} width
						</label>
					</div>
				</div>
			</div>
			<table v-if="fieldValue.type != 'checkbox' || controlNumber > 0" class="table table-striped table-hover">
				<thead>
					<tr>
						<th>Option</th>
						<th v-if="fieldValue.type == 'checkbox'">Label (for legend)</th>
						<th v-if="fieldValue.controlColour">Colour</th>
						<th v-if="fieldValue.controlSize">Size</th>
						<th v-if="fieldValue.controlSymbol">Icon</th>
						<th v-if="fieldValue.controlShape">Shape</th>
						<th v-if="fieldValue.controlWidth">Width</th>
						<th v-if="fieldValue.type != 'checkbox'"></th>
						<th v-if="fieldValue.type != 'checkbox'" class="move"></th>
					</tr>
				</thead>
				<draggable v-model="fieldValue.options" tag="tbody" handle=".fm-drag-handle">
					<tr v-for="(option, idx) in fieldValue.options">
						<td v-if="fieldValue.type == 'checkbox'">
							<strong>{{idx === 0 ? '✘' : '✔'}}</strong>
						</td>
						<td class="field">
							<ValidationProvider :name="`Label (${option.value})`" v-slot="v" :rules="fieldValue.type == 'checkbox' ? '' : 'uniqueFieldOptionValue:@field'">
								<input class="form-control" v-model="option.value" :state="v | validationState" />
								<div class="invalid-feedback" v-if="v.errors[0]" v-html="v.errors[0]"></div>
							</ValidationProvider>
						</td>
						<td v-if="fieldValue.controlColour" class="field">
							<ValidationProvider :name="`Colour (${option.value})`" v-slot="v" rules="required|colour">
								<ColourField v-model="option.colour" :state="v | validationState"></ColourField>
								<div class="invalid-feedback" v-if="v.errors[0]" v-html="v.errors[0]"></div>
							</ValidationProvider>
						</td>
						<td v-if="fieldValue.controlSize" class="field">
							<ValidationProvider :name="`Size (${option.value})`" v-slot="v" rules="required|size">
								<SizeField v-model="option.size" :state="v | validationState"></SizeField>
								<div class="invalid-feedback" v-if="v.errors[0]" v-html="v.errors[0]"></div>
							</ValidationProvider>
						</td>
						<td v-if="fieldValue.controlSymbol" class="field">
							<ValidationProvider :name="`Icon (${option.value})`" v-slot="v" rules="symbol">
								<SymbolField v-model="option.symbol" :state="v | validationState"></SymbolField>
								<div class="invalid-feedback" v-if="v.errors[0]" v-html="v.errors[0]"></div>
							</ValidationProvider>
						</td>
						<td v-if="fieldValue.controlShape" class="field">
							<ValidationProvider :name="`Shape (${option.value})`" v-slot="v" rules="shape">
								<ShapeField v-model="option.shape" :state="v | validationState"></ShapeField>
								<div class="invalid-feedback" v-if="v.errors[0]" v-html="v.errors[0]"></div>
							</ValidationProvider>
						</td>
						<td v-if="fieldValue.controlWidth" class="field">
							<ValidationProvider :name="`Width (${option.value})`" v-slot="v" rules="required|width">
								<WidthField v-model="option.width" :state="v | validationState"></WidthField>
								<div class="invalid-feedback" v-if="v.errors[0]" v-html="v.errors[0]"></div>
							</ValidationProvider>
						</td>
						<td v-if="fieldValue.type != 'checkbox'" class="td-buttons">
							<button type="button" class="btn btn-light" @click="deleteOption(option)"><Icon icon="minus" alt="Remove"></Icon></button>
						</td>
						<td v-if="fieldValue.type != 'checkbox'" class="td-buttons">
							<button type="button" class="btn btn-light fm-drag-handle"><Icon icon="resize-vertical" alt="Reorder"></Icon></button>
						</td>
					</tr>
				</draggable>
				<tfoot v-if="fieldValue.type != 'checkbox'">
					<tr>
						<td><button type="button" class="btn btn-light" @click="addOption()"><Icon icon="plus" alt="Add"></Icon></button></td>
					</tr>
				</tfoot>
			</table>

			<ValidationProvider vid="field" ref="fieldValidationProvider" v-slot="v" rules="fieldOptionNumber" immediate>
				<div class="invalid-feedback" v-if="v.errors[0]" v-html="v.errors[0]"></div>
			</ValidationProvider>
		</template>
	</FormModal>
</template>

<style lang="scss">
	.fm-edit-type-dropdown {
		td.field {
			min-width: 10rem;
		}
	}
</style>